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

## API

- `POST /api/rooms`
- `POST /api/rooms/{roomCode}/join`
- `GET /api/rooms/{roomCode}`
- `POST /api/rooms/{roomCode}/ready`
- `POST /api/rooms/{roomCode}/leave`
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
