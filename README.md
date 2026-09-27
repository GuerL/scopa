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
