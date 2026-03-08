# fidar-vpn

Telegram bot + worker for VPN client lifecycle and payments.

## Stack
- Node.js + TypeScript
- Docker / Docker Compose
- PostgreSQL (via `DATABASE_URL`)

## Local Run
1. Install dependencies:
```bash
yarn
```

2. Create env file:
```bash
cp .env.example .env
```

3. Build and start:
```bash
yarn build
yarn start
```

Worker (separate process):
```bash
yarn workers
```

## Docker
Build image locally:
```bash
docker build -t fidar-vpn:local .
```

Run with compose:
```bash
docker compose --env-file .env up -d
```

## Deploy
Production deploy flow, rollback, and logging are documented in:
- [DEPLOY.md](./DEPLOY.md)
