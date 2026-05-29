# Деплой AlexFruit на Timeweb Cloud

Эта схема рассчитана на простой временный сервер: один VPS, Docker, PostgreSQL в контейнере и Caddy как reverse proxy с автоматическим HTTPS.

## 1. Подготовить сервер

1. Создайте VPS в Timeweb Cloud на Ubuntu 22.04/24.04.
2. Направьте домен или поддомен на IP сервера через A-запись.
3. Откройте порты `80` и `443` в firewall.
4. Установите Docker и Compose plugin:

```bash
sudo apt update
sudo apt install -y ca-certificates curl git
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker $USER
```

После `usermod` выйдите из SSH и зайдите снова.

## 2. Загрузить проект

```bash
cd /opt
sudo git clone https://github.com/Maxim-hub2020/alexfruit.git
sudo chown -R $USER:$USER alexfruit
cd alexfruit
```

Если репозиторий приватный, используйте GitHub token или SSH-ключ.

## 3. Создать серверный .env

```bash
cp deploy/env.timeweb.example .env
nano .env
```

Обязательно поменяйте:

- `APP_DOMAIN` — домен без `https://`, например `alexfruit.ru`;
- `APP_URL` — полный HTTPS-адрес, например `https://alexfruit.ru`;
- `ACME_EMAIL` — email для выпуска SSL-сертификата Let's Encrypt;
- `POSTGRES_PASSWORD` — пароль базы;
- `DATABASE_URL` — тот же пароль внутри строки подключения;
- `JWT_SECRET` — длинная случайная строка;
- `DADATA_API_KEY` — ключ DaData;
- `NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY`, `WEB_PUSH_PRIVATE_KEY`, `WEB_PUSH_SUBJECT` — ключи push-уведомлений;
- `DEFAULT_ADMIN_PASSWORD` — пароль первого администратора.

Реальный `.env` не должен попадать в GitHub.

VAPID-ключи для push-уведомлений можно сгенерировать на сервере после клонирования проекта:

```bash
docker run --rm node:22-alpine sh -lc "npm install -g web-push && web-push generate-vapid-keys"
```

Полученный `Public Key` вставьте в `NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY`, а `Private Key` — в `WEB_PUSH_PRIVATE_KEY`. В `WEB_PUSH_SUBJECT` укажите HTTPS-адрес сайта, например `https://alexfruit.ru`.

## 4. Первый запуск

```bash
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml logs -f app
```

При старте приложение само применит Prisma migrations командой `prisma migrate deploy`.

Чтобы залить стартовые товары, слоты и тестовые аккаунты:

```bash
docker compose -f docker-compose.prod.yml exec app npm run db:seed
```

## 5. Обновление через GitHub

После каждого push в GitHub на сервере:

```bash
cd /opt/alexfruit
sh scripts/deploy-update.sh
```

Скрипт делает:

- `git pull --ff-only`;
- сборку нового Docker-образа `alexfruit-prod-app:latest`;
- пересоздание контейнеров `app` и `proxy`;
- очистку старых Docker-образов.

Файл `.env` и данные PostgreSQL при этом остаются на сервере.

Если GitHub Actions не может подключиться к серверу по SSH, можно выполнить обновление вручную прямо на Timeweb:

```bash
cd /opt/alexfruit
sh scripts/deploy-update.sh
docker compose -f docker-compose.prod.yml logs --tail=80 app
```

## 6. Полезные команды

```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f app
docker compose -f docker-compose.prod.yml logs -f proxy
docker compose -f docker-compose.prod.yml restart app
docker compose -f docker-compose.prod.yml down
```

Не используйте `docker compose down -v`, если не хотите удалить базу данных.
