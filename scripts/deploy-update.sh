#!/usr/bin/env sh
set -eu

git pull --ff-only
docker compose -f docker-compose.prod.yml up -d --build
docker image prune -f
