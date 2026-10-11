# Scopa

Local development and deployment skeleton for Scopa.

## Local Startup

Create the shared Docker network once:

```bash
docker network create apps-network
```

Then build and run:

```bash
docker compose up --build
```

Open:

```text
http://localhost:8080
```

The frontend serves the production Vite build with Nginx. Browser traffic uses relative paths:

- `GET /api/health`
- `/ws/...` for future WebSocket traffic

The backend is also available at `http://localhost:8081` for local debugging.

## Manual Room Test

1. Open `http://localhost:8080` in one browser window.
2. Enter a display name and create a game.
3. Copy the displayed room code.
4. Open `http://localhost:8080` in a second browser window. Use a private window or another browser profile so it has separate local storage.
5. Enter a different display name and the room code, then join.
6. Toggle Ready / Not ready in either window.

Both lobbies should update without refreshing. The host sees a Start game button, which remains disabled until both players are ready.

Room state is in memory. Restarting the backend clears all rooms.

## Paused matches and rejoin

Leaving an unfinished match or disconnecting reserves the existing seat and pauses
the game. Hands, captured cards, scores, deck order, table, and turn stay in backend
memory. Lobby leave still removes the player normally.

The browser retains the room code, player ID, and session token. Entering the same
room code from that browser reclaims the existing seat; reopening the app also
attempts to restore it automatically. A name or room code alone cannot reclaim
another player's seat, and new players cannot enter a started match.

The pause dialog lists missing players and prominently displays the room code.
Only the host can resume, after every player returns. Rejoin does not automatically
resume or redeal. The host can instead confirm End game, which abandons the
unfinished round without scoring or declaring a winner and returns connected
players to the lobby. Missing seats are then released.

Everything remains in memory; there is no database. Restarting the backend loses
reserved seats and their game state.

Automated checks: run `mvn test` in `backend` and `npm test` plus `npm run build`
in `frontend`. An optional real-browser check is in
`frontend/tests/browserRejoin.mjs`; its opening comments describe the required
isolated backend and Chrome setup. It checks desktop and mobile touch layouts,
leave confirmation, rejoin, resume, reopening, and confirmed end.

## API

- `POST /api/rooms`
- `POST /api/rooms/{roomCode}/join`
- `GET /api/rooms/{roomCode}`
- `POST /api/rooms/{roomCode}/ready`
- `POST /api/rooms/{roomCode}/leave`
- `POST /api/rooms/{roomCode}/game/resume` (host only; all seats available)
- `POST /api/rooms/{roomCode}/game/end` (host only; paused match)
- `/ws/rooms/{roomCode}` for lobby room snapshots

## Stop

```bash
docker compose down
```

## Full Rebuild

```bash
docker compose down
docker compose build --no-cache
docker compose up
```
