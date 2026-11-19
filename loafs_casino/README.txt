# LOAFS CASINO — multiplayer starter

## Included
- Neon blue / purple / pink casino interface
- Private rooms with shareable room codes
- Live table chat
- Online friend requests (friends must be online)
- Shared multiplayer Blackjack table
- Virtual chips only

## Run on Windows
1. Install Node.js LTS from https://nodejs.org/
2. Extract this ZIP.
3. Open the extracted `loafs_casino` folder.
4. Click the folder address bar, type `cmd`, and press Enter.
5. Run: `npm install`
6. Run: `npm start`
7. Open http://localhost:3000 in Chrome.

## Let friends connect
`localhost` only works on your own computer. To let friends connect over the internet, deploy this folder to a Node.js host that supports WebSockets (for example, Render or Railway), then share the hosted website URL. For testing on the same Wi-Fi, friends can use your computer's local network IP and port 3000 if your firewall allows it.

## Important prototype limitations
- This is a starter prototype, not a production casino platform.
- User profiles, friend lists, and chips are temporary and reset when the server restarts or a player reconnects.
- Friend requests work only while both players are online.
- Blackjack is the shared multiplayer game in this starter. Baccarat and Roulette are shown as table choices but their shared game logic still needs to be built.
- Use virtual chips only; no real-money deposits, withdrawals, or wagering.
- Before a public launch, add secure accounts, persistent storage, moderation/reporting, rate limits, and server-side validation for every game action.
