const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const crypto = require("crypto");

const app = express();
const server = http.createServer(app);
const io = new Server(server);
app.use(express.static("public"));

const rooms = new Map();
const players = new Map();

function makeRoom(code) {
  return { code, members: [], chat: [], game: "blackjack", round: null };
}
function roomFor(socket) {
  const p = players.get(socket.id);
  return p ? rooms.get(p.room) : null;
}
function publicRoom(room) {
  return {
    code: room.code,
    game: room.game,
    players: room.members.map(id => {
      const p = players.get(id);
      return p ? { id, name: p.name, chips: p.chips, ready: !!p.ready } : null;
    }).filter(Boolean),
    round: room.round ? {
      dealer: room.round.dealer,
      hands: room.round.hands,
      active: room.round.active,
      status: room.round.status,
      message: room.round.message
    } : null
  };
}
function emitRoom(room) {
  io.to(room.code).emit("room:update", publicRoom(room));
}
function card() {
  const suits = ["♠","♥","♦","♣"];
  const ranks = ["A","2","3","4","5","6","7","8","9","10","J","Q","K"];
  return { r: ranks[Math.floor(Math.random()*13)], s: suits[Math.floor(Math.random()*4)] };
}
function val(c) {
  if (["J","Q","K"].includes(c.r)) return 10;
  return c.r === "A" ? 11 : Number(c.r);
}
function score(hand) {
  let n = hand.reduce((a,c)=>a+val(c),0);
  let aces = hand.filter(c=>c.r==="A").length;
  while (n>21 && aces--) n-=10;
  return n;
}
function finish(room, message) {
  const r = room.round;
  while (score(r.dealer)<17) r.dealer.push(card());
  const ds = score(r.dealer);
  for (const id of room.members) {
    const p = players.get(id), h = r.hands[id];
    if (!p || !h) continue;
    const ps = score(h.cards);
    if (ps<=21 && (ds>21 || ps>ds)) p.chips += h.bet*2;
    else if (ps===ds) p.chips += h.bet;
  }
  r.status = "finished";
  r.message = message || "Round complete. Check the table results.";
  emitRoom(room);
}

io.on("connection", socket => {
  socket.on("profile:create", rawName => {
    const name = String(rawName || "Player").trim().slice(0,18) || "Player";
    players.set(socket.id, { name, chips: 1000, room: null, ready: false, friends: [] });
    socket.emit("profile:ready", { name, chips: 1000 });
  });

  socket.on("room:create", () => {
    const p = players.get(socket.id);
    if (!p) return;
    const code = crypto.randomBytes(3).toString("hex").toUpperCase();
    const room = makeRoom(code);
    rooms.set(code, room);
    joinRoom(socket, room, p);
  });

  socket.on("room:join", rawCode => {
    const p = players.get(socket.id);
    const code = String(rawCode || "").trim().toUpperCase();
    const room = rooms.get(code);
    if (!p || !room) return socket.emit("notice", "That room code was not found.");
    if (room.members.length >= 6) return socket.emit("notice", "This table is full (6 players maximum).");
    joinRoom(socket, room, p);
  });

  function joinRoom(sock, room, p) {
    if (p.room) {
      const old = rooms.get(p.room);
      if (old) { old.members = old.members.filter(id=>id!==sock.id); emitRoom(old); }
      sock.leave(p.room);
    }
    p.room = room.code; p.ready = false;
    room.members.push(sock.id);
    sock.join(room.code);
    sock.emit("room:joined", room.code);
    emitRoom(room);
    io.to(room.code).emit("chat:message", { name:"LOAFS HOST", text:`${p.name} joined the table.`, system:true });
  }

  socket.on("game:select", game => {
    const room = roomFor(socket);
    if (!room || !["blackjack","baccarat","roulette"].includes(game)) return;
    room.game = game; room.round = null; emitRoom(room);
  });

  socket.on("chat:send", text => {
    const room = roomFor(socket), p = players.get(socket.id);
    if (!room || !p) return;
    const clean = String(text || "").trim().slice(0,180);
    if (!clean) return;
    io.to(room.code).emit("chat:message", { name:p.name, text:clean });
  });

  socket.on("friend:request", targetName => {
    const p = players.get(socket.id);
    if (!p) return;
    const target = [...players.entries()].find(([id,x])=>id!==socket.id && x.name.toLowerCase()===String(targetName).toLowerCase());
    if (!target) return socket.emit("notice","That player isn't online right now.");
    io.to(target[0]).emit("friend:request", { name:p.name });
    socket.emit("notice",`Friend request sent to ${target[1].name}.`);
  });
  socket.on("friend:respond", data => {
    const p = players.get(socket.id);
    const from = [...players.entries()].find(([id,x])=>x.name===data.name);
    if (!p || !from) return socket.emit("notice","That player is no longer online.");
    if (data.accept) {
      p.friends.push(data.name);
      from[1].friends.push(p.name);
      io.to(from[0]).emit("notice",`${p.name} accepted your friend request.`);
      socket.emit("notice",`${data.name} added as a friend.`);
    }
  });

  socket.on("bj:start", betValue => {
    const room = roomFor(socket), p = players.get(socket.id);
    if (!room || !p || room.game!=="blackjack") return;
    if (room.round && room.round.status==="playing") return socket.emit("notice","A round is already in progress.");
    const bet = Math.floor(Number(betValue));
    if (!bet || bet<1 || bet>p.chips) return socket.emit("notice","Enter a valid bet within your chip balance.");
    const hands = {};
    for (const id of room.members) {
      const player = players.get(id);
      if (player && player.ready) {
        const amount = id===socket.id ? bet : 0;
        if (amount>0) player.chips-=amount;
        hands[id] = { cards:[card(),card()], bet:amount, done:false };
      }
    }
    if (!hands[socket.id]) {
      p.chips-=bet;
      hands[socket.id] = { cards:[card(),card()], bet, done:false };
    }
    room.round = { dealer:[card(),card()], hands, active:socket.id, status:"playing", message:"Players take turns. Hit or stand." };
    emitRoom(room);
  });

  socket.on("bj:action", action => {
    const room = roomFor(socket), p = players.get(socket.id), r = room && room.round;
    if (!room || !p || !r || r.status!=="playing" || r.active!==socket.id) return;
    const hand = r.hands[socket.id];
    if (!hand || hand.done) return;
    if (action==="hit") {
      hand.cards.push(card());
      if (score(hand.cards)>=21) hand.done=true;
    } else if (action==="stand") hand.done=true;
    else if (action==="double") {
      if (hand.cards.length!==2 || p.chips<hand.bet) return socket.emit("notice","Not enough chips to double.");
      p.chips-=hand.bet; hand.bet*=2; hand.cards.push(card()); hand.done=true;
    }
    const next = room.members.find(id=>r.hands[id] && !r.hands[id].done);
    if (next) r.active=next;
    else finish(room);
    emitRoom(room);
  });

  socket.on("disconnect", () => {
    const p = players.get(socket.id);
    if (p && p.room) {
      const room = rooms.get(p.room);
      if (room) {
        room.members = room.members.filter(id=>id!==socket.id);
        if (!room.members.length) rooms.delete(room.code);
        else emitRoom(room);
      }
    }
    players.delete(socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`LOAFS CASINO running at http://localhost:${PORT}`));
