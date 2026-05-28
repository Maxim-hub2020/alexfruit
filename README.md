# АлексФрут

MVP веб-приложения доставки фруктов и овощей для Ростова-на-Дону. Проект покрывает клиентскую витрину, оформление заказа, личный кабинет клиента, админ-панель и кабинет курьера.

## Что внутри

- `Next.js 16` + `React 19` + `TypeScript`
- `Prisma` + `PostgreSQL`
- Роли: `CUSTOMER`, `ADMIN`, `COURIER`
- API роуты под заказы, каталог, адреса, интервалы доставки и доставку
- Адаптивный UI с отдельными сценариями для клиента, администратора и курьера

## Основные сценарии MVP

- Регистрация и вход по email/телефону + паролю
- Каталог с фильтрами и добавлением в корзину
- Оформление заказа с адресом, датой и временным окном
- Ограничение заказов по временным слотам
- История заказов и повтор заказа
- Админ-панель с дашбордом, управлением заказами и каталогом
- Кабинет курьера с задачами на день и сменой статусов
- Внутренние уведомления в профиле клиента

## Структура

- `src/app` — страницы и API роуты
- `src/components` — UI, витрина, админка, кабинет курьера
- `src/lib` — Prisma, auth, сервисы заказов, валидация
- `prisma/schema.prisma` — доменная схема
- `prisma/seed.ts` — seed-данные
- `prisma/migrations/0001_init/migration.sql` — стартовая миграция

## Переменные окружения

Скопируйте `.env.example` в `.env` и заполните значения:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/alexfrut
JWT_SECRET=replace-with-a-long-secret
APP_URL=http://localhost:3000
YANDEX_MAPS_API_KEY=
DADATA_API_KEY=
NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY=
WEB_PUSH_PRIVATE_KEY=
WEB_PUSH_SUBJECT=https://your-domain.example
STORAGE_ACCESS_KEY=
STORAGE_SECRET_KEY=
STORAGE_BUCKET=
STORAGE_ENDPOINT=
DEFAULT_ADMIN_EMAIL=admin@alexfrut.local
DEFAULT_ADMIN_PASSWORD=admin12345
DEFAULT_COURIER_EMAIL=courier@alexfrut.local
DEFAULT_COURIER_PASSWORD=courier12345
DEFAULT_CUSTOMER_EMAIL=customer@alexfrut.local
DEFAULT_CUSTOMER_PASSWORD=customer12345
RATE_LIMIT_AUTH_MAX=8
RATE_LIMIT_AUTH_WINDOW_MS=60000
RATE_LIMIT_ORDERS_MAX=25
RATE_LIMIT_ORDERS_WINDOW_MS=60000
RATE_LIMIT_API_MAX=180
RATE_LIMIT_API_WINDOW_MS=60000
RATE_LIMIT_STAFF_MAX=120
RATE_LIMIT_STAFF_WINDOW_MS=60000
RATE_LIMIT_PAGE_MAX=240
RATE_LIMIT_PAGE_WINDOW_MS=60000
RATE_LIMIT_MAX_BUCKETS=5000
```

`DADATA_API_KEY` нужен для автоподсказок адреса DaData в профиле клиента. Ключ используется только на сервере через `/api/geo/suggest`, в браузер он не передаётся.

`NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY`, `WEB_PUSH_PRIVATE_KEY` и `WEB_PUSH_SUBJECT` нужны для фоновых push-уведомлений через service worker. Публичный ключ можно отдавать в браузер, приватный ключ должен оставаться только на сервере. Для iPhone `WEB_PUSH_SUBJECT` лучше задавать HTTPS-адресом сайта, а не локальным `mailto`, иначе Apple может отклонять отправку с `BadJwtToken`.

## Защита от частых запросов

В `src/proxy.ts` включена прикладная защита от злоупотреблений:

- отдельный лимит на вход и регистрацию;
- отдельный лимит на создание и изменение заказов;
- отдельный лимит на админские и курьерские API;
- общий лимит на API и страницы;
- security headers: `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`.

Это снижает риск brute force и перегрузки API, но не заменяет полноценную DDoS-защиту на уровне инфраструктуры. Для продакшена дополнительно ставьте reverse proxy, HTTPS, WAF/CDN и сетевую защиту перед VM.

## Локальный запуск

### Быстрый старт на Windows

Проект можно поднять без Docker через Prisma Dev:

```powershell
npm run local:dev
```

Скрипт сам:

- поднимет локальный Prisma Dev PostgreSQL;
- создаст `.env.local`;
- применит миграцию;
- зальёт seed-данные;
- запустит Next.js на `http://127.0.0.1:3000`.

Если нужна только подготовка базы и `.env.local`, без запуска веб-сервера:

```powershell
npm run local:bootstrap
```

Остановить локальный стенд:

```powershell
npm run local:stop
```

### Ручной вариант

1. Установите зависимости:

```bash
npm install
```

2. Поднимите контейнерную базу или используйте свою PostgreSQL:

```bash
docker compose up -d db
```

3. Скопируйте `.env.example` в `.env.local` и пропишите `DATABASE_URL`.

4. Примените миграции и seed:

```bash
npm run db:generate
npx prisma migrate deploy
npm run db:seed
```

5. Запустите приложение:

```bash
npm run dev
```

## Demo-аккаунты

- Администратор: `admin@alexfrut.local` / `admin12345`
- Курьер: `courier@alexfrut.local` / `courier12345`
- Клиент: `customer@alexfrut.local` / `customer12345`

Если вы меняете переменные `DEFAULT_*`, seed создаст пользователей с вашими значениями.

## Docker

Полный локальный запуск приложения и базы:

```bash
docker compose up --build
```

## Развёртывание в Yandex Cloud

Рекомендуемая схема:

1. `Compute Cloud` — VM под контейнер приложения.
2. `Managed Service for PostgreSQL` — боевая база.
3. `Object Storage` — хранение фото и файлов.

Для продакшена:

- замените `DATABASE_URL` на строку Managed PostgreSQL;
- задайте надёжный `JWT_SECRET`;
- вынесите `STORAGE_*` в секреты окружения;
- подключите домен и HTTPS через reverse proxy;
- включите внешний WAF/CDN и сетевую DDoS-защиту перед VM.

## Покрытые API endpoints

### Auth

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`

### Products / Categories

- `GET /api/products`
- `GET /api/products/:id`
- `GET /api/categories`
- `POST /api/admin/products`
- `PATCH /api/admin/products/:id`
- `DELETE /api/admin/products/:id`
- `POST /api/admin/categories`
- `PATCH /api/admin/categories/:id`
- `DELETE /api/admin/categories/:id`

### Orders / Cart

- `POST /api/orders`
- `GET /api/orders/my`
- `GET /api/orders/:id`
- `PATCH /api/orders/:id/edit`
- `POST /api/orders/:id/repeat`
- `POST /api/orders/:id/cancel`

### Admin orders / delivery

- `GET /api/admin/orders`
- `GET /api/admin/orders/:id`
- `PATCH /api/admin/orders/:id`
- `PATCH /api/admin/orders/:id/status`
- `PATCH /api/admin/orders/:id/items`
- `PATCH /api/admin/orders/:id/assign-courier`
- `GET /api/admin/delivery`

### Addresses / courier / time slots

- `GET /api/addresses`
- `POST /api/addresses`
- `PATCH /api/addresses/:id`
- `DELETE /api/addresses/:id`
- `PATCH /api/addresses/:id/set-default`
- `GET /api/geo/suggest?text=Пушкинская%20104`
- `GET /api/notifications`
- `GET /api/push/config`
- `POST /api/push/subscriptions`
- `DELETE /api/push/subscriptions`
- `GET /api/courier/tasks`
- `PATCH /api/courier/tasks/:id/status`
- `PATCH /api/courier/tasks/:id/problem`
- `GET /api/time-slots`
- `GET /api/time-slots/available?date=YYYY-MM-DD`
- `POST /api/admin/time-slots`
- `PATCH /api/admin/time-slots/:id`

## Что заложено на следующий этап

- Расширенная интеграция Яндекс.Карт и маршрутизации
- Маршрутизация и балансировка заказов по курьерам
- Telegram / WhatsApp / SMS уведомления
- Онлайн-оплата, бонусы, промокоды, регулярные заказы
