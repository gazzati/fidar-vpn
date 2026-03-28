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
yarn start:worker
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

## Peer Monitoring
Bot includes a background worker that monitors WireGuard peer state on VPN servers.

### How It Works
- Every active server from the `servers` table is polled every 5 minutes.
- Bot requests peer metrics from `wireguard-server` endpoint `GET /peers`.
- Monitoring is based on live WireGuard peer data: `public_key`, `endpoint`, `latest_handshake_at`, `rx_bytes`, `tx_bytes`, `allowed_ips`.
- Peer status is determined from `latest_handshake_at`.

### Peer States
- `healthy`: latest handshake is newer than `STALE_HANDSHAKE_SEC` (currently 30 minutes).
- `stale`: peer exists on server, but latest handshake is older than `STALE_HANDSHAKE_SEC`.
- `never_connected`: peer exists on server, but WireGuard has never seen a handshake for it.

### Alerts
Worker sends alerts to the system Telegram bot chat in these cases:
- VPN server is unavailable.
- VPN server recovers after being unavailable.
- A client exists in bot database, but its `public_key` is missing on the assigned WireGuard server.
- A server previously had healthy peers, and then healthy peer count dropped to zero.
- A server recovers from zero healthy peers.

Notes:
- Missing peer alerts are suppressed for newly created clients for `NEW_CLIENT_GRACE_SEC` (currently 30 minutes).
- Zero-healthy-peers alert is only sent on state transition to avoid noise during idle periods.

### System Commands
System bot supports operational commands in the system chat:
- `/help` - list available system commands
- `/status` - application and database status
- `/servers` - check active VPN server reachability
- `/peer {client_id}` - show live WireGuard peer data for a client

Example:
```text
/peer 42
```

`/peer` output includes:
- client id and user id
- assigned server
- client active flag and subscription expiry
- peer health status
- latest handshake time and age
- endpoint
- RX / TX traffic counters
- allowed IPs
- server response time context

### Dependency on `wireguard-server`
Peer monitoring requires the matching `wireguard-server` version that exposes:
- `GET /peers`

If bot is deployed before VPN servers are updated, peer monitoring and `/peer` command will fail for those servers.
