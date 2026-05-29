#!/usr/bin/env sh
set -eu

git pull --ff-only
docker build -t alexfruit-prod-app:latest .
docker compose -f docker-compose.prod.yml up -d --force-recreate app proxy
docker image prune -f
