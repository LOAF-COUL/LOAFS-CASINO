const express = require('express');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const { Pool } = require('pg');

const app = express();
app.use(express.json({limit:'20kb'}));
app.use(cookieParser());
app.use(express.static(path.join(__dirname,'public')));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});
const JWT_SECRET = process.env.JWT_SECRET;
if (!process.env.DATABASE_URL) console.warn('DATABASE_URL is not configured');
if (!JWT_SECRET) console.warn('JWT_SECRET is not configured');

const authLimiter = rateLimit({windowMs: 15*60*1000, limit: 25, standardHeaders: true, legacyHeaders: false});
const spinLimiter = rateLimit({windowMs: 60*1000, limit: 8, standardHeaders: true, legacyHeaders: false});

async function initDb(){
  await pool.query(`
    CREATE TABLE IF NOT EXISTS players (
      id BIGSERIAL PRIMARY KEY,
      username VARCHAR(20) UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      chips BIGINT NOT NULL DEFAULT 5000 CHECK (chips >= 0),
      last_daily_spin DATE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}
function setAuth(res, playerId){
  const token = jwt.sign({sub:String(playerId)}, JWT_SECRET, {expiresIn:'14d'});
  res.cookie('loafs_session', token, {
    httpOnly:true, secure: process.env.NODE_ENV === 'production',
    sameSite:'lax', maxAge:14*24*60*60*1000, path:'/'
  });
}
async function getPlayer(req){
  const token=req.cookies && req.cookies.loafs_session;
  if(!token) return null;
  try{
    const decoded=jwt.verify(token, JWT_SECRET);
    const result=await pool.query('SELECT id, username, chips, last_daily_spin FROM players WHERE id=$1',[decoded.sub]);
    return result.rows[0] || null;
  }catch(e){ return null; }
}
function publicPlayer(p){
  return {id:p.id, username:p.username, chips:Number(p.chips), dailySpinAvailable: !p.last_daily_spin || p.last_daily_spin.toISOString?.().slice(0,10) !== new Date().toISOString().slice(0,10) && String(p.last_daily_spin).slice(0,10)!==new Date().toISOString().slice(0,10)};
}
app.get('/api/health',(req,res)=>res.json({ok:true}));

app.post('/api/register',authLimiter,async(req,res)=>{
  try{
    const username=String(req.body.username||'').trim();
    const password=String(req.body.password||'');
    if(!/^[A-Za-z0-9_]{3,20}$/.test(username)) return res.status(400).json({error:'Username must be 3–20 characters: letters, numbers or underscores.'});
    if(password.length<10 || password.length>72) return res.status(400).json({error:'Password must be 10–72 characters.'});
    const hash=await bcrypt.hash(password,12);
    const r=await pool.query('INSERT INTO players(username,password_hash,chips) VALUES($1,$2,5000) RETURNING id,username,chips,last_daily_spin',[username,hash]);
    setAuth(res,r.rows[0].id);
    res.json({player:publicPlayer(r.rows[0]),welcome:true});
  }catch(e){
    if(e.code==='23505') return res.status(409).json({error:'That username is already taken.'});
    console.error(e);res.status(500).json({error:'Could not create account. Check the server database settings.'});
  }
});
app.post('/api/login',authLimiter,async(req,res)=>{
  try{
    const username=String(req.body.username||'').trim();
    const password=String(req.body.password||'');
    const r=await pool.query('SELECT id,username,password_hash,chips,last_daily_spin FROM players WHERE LOWER(username)=LOWER($1)',[username]);
    if(!r.rows[0] || !(await bcrypt.compare(password,r.rows[0].password_hash))) return res.status(401).json({error:'Username or password is incorrect.'});
    setAuth(res,r.rows[0].id);
    res.json({player:publicPlayer(r.rows[0])});
  }catch(e){console.error(e);res.status(500).json({error:'Login is temporarily unavailable.'});}
});
app.post('/api/logout',(req,res)=>{res.clearCookie('loafs_session',{path:'/'});res.json({ok:true});});
app.get('/api/me',async(req,res)=>{
  const p=await getPlayer(req);
  if(!p) return res.status(401).json({error:'Please log in.'});
  res.json({player:publicPlayer(p)});
});
app.post('/api/daily-spin',spinLimiter,async(req,res)=>{
  const p=await getPlayer(req);
  if(!p) return res.status(401).json({error:'Please log in first.'});
  const rewards=[250,500,750,1000,1500,2000,3000];
  const reward=rewards[Math.floor(Math.random()*rewards.length)];
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const locked=await client.query('SELECT id,chips,last_daily_spin FROM players WHERE id=$1 FOR UPDATE',[p.id]);
    const last=locked.rows[0].last_daily_spin;
    const lastDay=last ? new Date(last).toISOString().slice(0,10) : null;
    const today=new Date().toISOString().slice(0,10);
    if(lastDay===today){await client.query('ROLLBACK');return res.status(409).json({error:'Your daily spin has already been used. Come back tomorrow.'});}
    const updated=await client.query('UPDATE players SET chips=chips+$1,last_daily_spin=CURRENT_DATE WHERE id=$2 RETURNING id,username,chips,last_daily_spin',[reward,p.id]);
    await client.query('COMMIT');
    res.json({reward,player:publicPlayer(updated.rows[0])});
  }catch(e){await client.query('ROLLBACK');console.error(e);res.status(500).json({error:'The wheel could not be spun. Please try again.'});}
  finally{client.release();}
});
app.post('/api/chips/adjust',async(req,res)=>{
  const p=await getPlayer(req);
  if(!p) return res.status(401).json({error:'Please log in.'});
  const delta=Number(req.body.delta);
  if(!Number.isSafeInteger(delta)||delta===0||Math.abs(delta)>5000) return res.status(400).json({error:'Invalid chip adjustment.'});
  const r=await pool.query('UPDATE players SET chips=chips+$1 WHERE id=$2 AND chips+$1>=0 RETURNING id,username,chips,last_daily_spin',[delta,p.id]);
  if(!r.rowCount) return res.status(400).json({error:'Not enough chips.'});
  res.json({player:publicPlayer(r.rows[0])});
});
app.get('*',(req,res)=>res.sendFile(path.join(__dirname,'public','index.html')));

const port=process.env.PORT||3000;
initDb().then(()=>app.listen(port,'0.0.0.0',()=>console.log('LOAFS CASINO v4 listening on '+port)))
.catch(e=>{console.error('Database initialization failed:',e);process.exit(1);});
