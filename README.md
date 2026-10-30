# Two-Team Virtual Points Game

## Run it on your computer
1. Install Node.js 18 or newer from https://nodejs.org/
2. Extract this folder.
3. Open a terminal in this folder.
4. Run `npm install`
5. Run `npm start`
6. Open http://localhost:3000

## Put it on the internet (Render)
1. Create a GitHub account if you do not have one.
2. Upload this project folder to a new GitHub repository.
3. Create an account at https://render.com and choose **New + → Web Service**.
4. Connect your GitHub repository.
5. Set Build Command to `npm install` and Start Command to `npm start`.
6. Deploy. Render will give you a public URL. Share that URL with players.
7. The host creates a room and shares the six-character room code.

## Game rules
- Every new player starts with the room's starting virtual points.
- Players choose Team A or Team B.
- Contributions are deducted from each player's own balance and added to the shared pot.
- The host selects the winning team.
- The pot is divided as evenly as possible among players on the winning team.
- The remainder points are distributed one each to the first winners in the room's player order.
- The host can start another round.

## Important prototype limitations
- This version uses fictional points only. It does not accept or transfer real money.
- Rooms are held in server memory. If the server restarts or goes to sleep, active rooms and scores are lost.
- This is a starter multiplayer prototype, not a tamper-proof competitive platform. Anyone with a room code can join; share codes only with people you trust.