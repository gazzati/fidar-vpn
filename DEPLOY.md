# Deploy with Docker Compose

## What Changed
- Deploy больше не делает `git pull` на VPS.
- GitHub Actions собирает Docker image и пушит immutable-теги (`sha-<commit>`).
- Текущий tag деплоя хранится на сервере в `.env.deploy`.
- Приложение запускается двумя процессами: `fidar-bot` и `fidar-worker`.

## Deploy Flow
1. GitHub Actions собирает Docker image.
2. Образ пушится с тегами:
   - `gazzati/fidar-vpn:sha-<commit>`
   - `gazzati/fidar-vpn:latest`
3. Deploy job подключается к VPS и пишет `.env.deploy`:
   - `IMAGE_TAG=sha-<commit>`
4. `docker compose` делает pull и перезапускает `fidar-bot` и `fidar-worker`.

## Required VPS Layout
Используй отдельную директорию проекта на VPS без `git clone` приложения.

Пример:
- `/home/pm2/fidar-vpn/docker-compose.yml`
- `/home/pm2/fidar-vpn/.env` (runtime env vars)
- `/home/pm2/fidar-vpn/.env.deploy` (создается деплоем автоматически)

Перед первым деплоем положи на VPS:
- `docker-compose.yml`
- `.env`

Workflow завершится ошибкой, если `.env` или `docker-compose.yml` отсутствуют.

## Required GitHub Secrets
- `DOCKERHUB_USERNAME`
- `DOCKERHUB_TOKEN`
- `SSH_HOST` (или legacy `HOST`)
- `SSH_USER` (или legacy `USERNAME`)
- `SSH_PRIVATE_KEY` (или legacy `PRIVATE_KEY`)

## Rollback
В директории проекта на VPS:

```bash
echo "IMAGE_TAG=sha-<old-commit>" > .env.deploy
docker compose --env-file .env --env-file .env.deploy pull fidar-bot fidar-worker
docker compose --env-file .env --env-file .env.deploy up -d fidar-bot fidar-worker
```
