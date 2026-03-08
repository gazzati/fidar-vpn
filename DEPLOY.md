# Deploy with Docker Compose

## What Changed
- Deploy does not run `git pull` on VPS.
- GitHub Actions builds and pushes immutable image tags (`sha-<commit>`).
- Current deploy tag is stored in `.env.deploy` on VPS.
- App runs in two services: `fidar-bot` and `fidar-worker`.
- Before service restart, current container logs are archived on server.

## Deploy Flow
1. GitHub Actions builds Docker image.
2. Image is pushed with tags:
   - `gazzati/fidar-vpn:sha-<commit>`
   - `gazzati/fidar-vpn:latest`
3. Deploy job connects to VPS and writes `.env.deploy`:
   - `IMAGE_TAG=sha-<commit>`
4. Deploy archives current logs to `logs/archive/*`.
5. `docker compose` pulls image and recreates `fidar-bot` + `fidar-worker`.

## Required VPS Layout
Use a dedicated runtime directory on VPS (without app source `git clone`).

Example:
- `/home/tim/fidar-vpn/docker-compose.yml`
- `/home/tim/fidar-vpn/.env` (runtime env vars)
- `/home/tim/fidar-vpn/.env.deploy` (created by deploy)
- `/home/tim/fidar-vpn/logs/archive` (archived logs before restart)

Before first deploy, place on VPS:
- `docker-compose.yml`
- `.env`

Workflow fails if `.env` or `docker-compose.yml` is missing.

## Required GitHub Secrets
- `DOCKERHUB_USERNAME`
- `DOCKERHUB_TOKEN`
- `SSH_HOST` (or legacy `HOST`)
- `SSH_USER` (or legacy `USERNAME`)
- `SSH_PRIVATE_KEY` (or legacy `PRIVATE_KEY`)

## Read Logs
Current running containers:
```bash
cd /home/tim/fidar-vpn
docker compose logs -f fidar-bot fidar-worker
```

Archived logs from previous containers:
```bash
cd /home/tim/fidar-vpn
ls -lah logs/archive
tail -n 200 logs/archive/fidar-bot_<timestamp>.log
tail -n 200 logs/archive/fidar-worker_<timestamp>.log
```

Search in archived logs:
```bash
cd /home/tim/fidar-vpn
rg -n "error|exception|failed" logs/archive
```

## Rollback
In VPS project directory:

```bash
echo "IMAGE_TAG=sha-<old-commit>" > .env.deploy
docker compose --env-file .env --env-file .env.deploy pull fidar-bot fidar-worker
docker compose --env-file .env --env-file .env.deploy up -d fidar-bot fidar-worker
```
