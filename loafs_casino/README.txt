LOAFS CASINO v4 — Accounts, virtual chips and daily wheel

IMPORTANT: Virtual chips are game-only points. They have no cash value.
This build does not accept payments, sell chips, allow cash-outs, transfers,
or exchange chips for prizes.

Files:
- package.json
- server.js
- public/index.html

Backend:
- PostgreSQL stores player accounts and chip balances.
- bcryptjs hashes passwords.
- JWT is stored in an HTTP-only cookie.
- New accounts start with 5,000 virtual chips.
- Daily wheel is enforced server-side once per calendar day.
- Basic rate limiting is enabled for account and wheel endpoints.

RENDER SETUP REQUIRED:
1. In Render, create a PostgreSQL database (New + > PostgreSQL).
2. Open the database page and copy its Internal Database URL.
3. Open the LOAFS-CASINO Web Service > Environment.
4. Add DATABASE_URL = the Internal Database URL.
5. Add JWT_SECRET = a long random secret (at least 32 random characters).
6. Save changes.
7. In the GitHub repository, replace package.json and server.js inside loafs_casino.
8. Replace index.html inside loafs_casino/public.
9. Commit changes and wait for Render to deploy.

Do not paste your database URL or JWT secret into chat or commit them to GitHub.
The service creates the players table automatically at startup.

Note: A daily spin uses the server's calendar date (UTC). This prototype has
accounts and persistent balances but does not yet implement friends or
multiplayer tables.
