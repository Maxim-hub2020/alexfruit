#!/usr/bin/env sh
set -eu

git pull --ff-only
docker build -t alexfruit-prod-app:latest .
docker compose -f docker-compose.prod.yml up -d --force-recreate app proxy
if grep -q '^RUN_PRODUCTION_SEED=true$' .env; then
  docker compose -f docker-compose.prod.yml exec -T app npm run db:seed
else
  echo "Skipping catalog seed. Set RUN_PRODUCTION_SEED=true in .env to run it intentionally."
fi
docker image prune -f
