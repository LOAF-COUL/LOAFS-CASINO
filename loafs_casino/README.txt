LOAFS CASINO V5 — animated practice arcade

This version keeps the account system and PostgreSQL persistence from V4,
with a redesigned navy/blue/pink game-room interface and animated practice games.

Included:
- Account registration and login (bcrypt password hashing, HTTP-only session cookie)
- 5,000 starting practice credits
- One fixed 500-credit daily login bonus (the wheel animation is decorative;
  every eligible account receives the same amount)
- Animated blackjack practice with card dealing/flips, hit and stand
- Baccarat practice with animated card reveals and automatic scoring
- Roulette wheel animation and numbered result display
- Red/white casino-style visual chips as cosmetic selectors and display pieces
- Responsive white, blue, pink and navy styling

Safety / economy:
- Credits are game-only practice points with no cash value.
- No deposits, purchases, cash-outs, transfers, wagering, stakes, side bets,
  payouts, prizes, or conversion of credits.
- Game rounds do not deduct or award credits.
- Chip denominations are cosmetic UI selections only.

Files:
- package.json
- server.js
- public/index.html

Render:
1. Keep your existing PostgreSQL database.
2. Keep DATABASE_URL and JWT_SECRET in Render Environment.
3. Replace package.json and server.js in the loafs_casino folder.
4. Replace public/index.html in loafs_casino/public.
5. Commit changes and wait for Render to deploy.

Never put DATABASE_URL or JWT_SECRET in GitHub or share them in chat.
