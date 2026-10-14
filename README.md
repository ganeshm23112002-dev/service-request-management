# Service Request Management

A Django REST Framework API and React/Vite client for employee service
requests, with JWT authentication, role-based administration, overdue
monitoring, and an optional Redis-backed dashboard cache.

## Prerequisites

- Python 3.14 and PostgreSQL.
- Node.js and npm.
- Redis for shared dashboard caching and Celery task delivery. Redis is
  optional for local API development, but without it the cache is process-local
  and scheduled tasks cannot be delivered.

## Backend setup

From the repository root, install backend dependencies and create a local
environment file:

```powershell
cd backend
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
Copy-Item .env.example .env
```

Edit `backend/.env` with a unique Django secret and the connection details for
your PostgreSQL database. Generate a secret locally with:

```powershell
.\.venv\Scripts\python.exe -c "import secrets; print(secrets.token_urlsafe(50))"
```

Never commit `.env` or replace the example placeholders with real credentials
in `.env.example`. Relevant settings:

| Variable | Purpose | Local example |
| --- | --- | --- |
| `SECRET_KEY` | Django signing key; required in every environment | Generate locally |
| `DJANGO_DEBUG` | Enables Django debug mode; defaults to `false` | `true` for local development |
| `ALLOWED_HOSTS` | Comma-separated Django hostnames; defaults to loopback hosts only | `localhost,127.0.0.1,[::1]` |
| `DB_NAME`, `DB_USER`, `DB_PASSWORD` | PostgreSQL database credentials | Set to local database values |
| `DB_HOST`, `DB_PORT` | PostgreSQL location | `localhost`, `5432` |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD` | Production SMTP server connection | Configure with your email provider |
| `SMTP_USE_TLS`, `SMTP_USE_SSL`, `DEFAULT_FROM_EMAIL` | SMTP transport and sender | Enable the mode required by your provider |
| `CORS_ALLOWED_ORIGINS` | Comma-separated trusted frontend origins | `http://localhost:5173,http://127.0.0.1:5173` |
| `REDIS_URL` | Django dashboard cache Redis URL | `redis://127.0.0.1:6379/1` |
| `CELERY_BROKER_URL` | Celery broker; defaults to Redis DB 0 | `redis://127.0.0.1:6379/0` |
| `DASHBOARD_SUMMARY_CACHE_TIMEOUT` | Summary cache lifetime in seconds | `60` |
| `CACHE_KEY_PREFIX` | Redis cache namespace | `service-request-management` |
| `SECURE_SSL_REDIRECT` | Redirect HTTP to HTTPS; defaults on when debug is off | `false` only for local HTTP |
| `SESSION_COOKIE_SECURE`, `CSRF_COOKIE_SECURE` | Require HTTPS for Django cookies; default on when debug is off | `false` only for local HTTP |
| `SECURE_HSTS_SECONDS` | HSTS lifetime; defaults to one year when debug is off | `0` only for local HTTP |

Apply database migrations and run Django checks:

```powershell
.\.venv\Scripts\python.exe manage.py migrate
.\.venv\Scripts\python.exe manage.py check
.\.venv\Scripts\python.exe manage.py runserver 127.0.0.1:8000
```

For the first administrator, create a Django superuser and assign the
application role to that trusted account from the Django shell. Do not expose
this bootstrap operation as a public endpoint:

```powershell
.\.venv\Scripts\python.exe manage.py createsuperuser
.\.venv\Scripts\python.exe manage.py shell -c "from django.contrib.auth import get_user_model; User = get_user_model(); User.objects.filter(username='YOUR_USERNAME').update(role=User.Role.ADMIN)"
```

Replace `YOUR_USERNAME` with the account created above. The role update must
be performed only by a trusted operator.

## Redis and scheduled overdue checks

For local development, Redis can be started with Docker Desktop:

```powershell
docker run --name service-request-redis -p 6379:6379 -d redis:7-alpine
```

Set `REDIS_URL` and `CELERY_BROKER_URL` in `backend/.env`. If `REDIS_URL` is
unset, Django uses a process-local memory cache; this is not Redis and is not
shared between web processes. If configured Redis is unavailable, dashboard
metrics are computed from PostgreSQL and a cache failure is logged.

Run one worker and one Beat scheduler in separate terminals, from `backend`:

```powershell
.\.venv\Scripts\celery.exe -A config worker --loglevel=info --pool=solo
```

```powershell
.\.venv\Scripts\celery.exe -A config beat --loglevel=info
```

Beat schedules `service_requests.tasks.check_overdue_requests` every five
minutes. Do not run multiple Beat schedulers against the same application
unless a distributed scheduler or lock is configured. Run a check manually:

```powershell
.\.venv\Scripts\python.exe manage.py shell -c "from service_requests.tasks import check_overdue_requests; print(check_overdue_requests.run())"
```

An OPEN or IN_PROGRESS request becomes overdue only when it is older than
24 hours. RESOLVED requests are never overdue. Successful checks save their
timestamp and invalidate the dashboard summary cache.

## Frontend setup

In a second terminal, from `frontend`:

```powershell
npm.cmd install
Copy-Item .env.example .env
npm.cmd run dev -- --host 127.0.0.1
```

The example API URL points to `http://127.0.0.1:8000/api`. The backend example
allows both `localhost` and `127.0.0.1` on Vite's development port. If you
change the frontend host or port, update `CORS_ALLOWED_ORIGINS` accordingly.
Build the production frontend with:

```powershell
npm.cmd run build
```

## API overview

All API responses use the `{ "status", "statusCode", "data" }` envelope.

| Method | Path | Access |
| --- | --- | --- |
| `POST` | `/api/auth/register/` | Public employee registration |
| `POST` | `/api/auth/login/` | Public JWT login |
| `POST` | `/api/auth/refresh/` | Public refresh-token exchange |
| `GET` | `/api/auth/me/` | Authenticated user |
| `POST` | `/api/auth/logout/` | Authenticated refresh-token blacklist |
| `GET`, `POST` | `/api/requests/` | Authenticated; employee-owned requests or all requests for admins |
| `GET`, `PUT`, `PATCH`, `DELETE` | `/api/requests/{id}/` | Owner or admin |
| `GET` | `/api/dashboard/summary/` | Admin |
| `GET` | `/api/admin/employees/` | Admin |
| `GET` | `/api/admin/employees/{id}/` | Admin |
| `POST` | `/api/admin/users/` | Admin-only admin account creation |

For example, after obtaining an admin access token, check dashboard metrics:

```powershell
curl.exe -H "Authorization: Bearer YOUR_ACCESS_TOKEN" http://127.0.0.1:8000/api/dashboard/summary/
```

## Tests and migration verification

From `backend`:

```powershell
.\.venv\Scripts\python.exe manage.py test accounts service_requests dashboard --settings=config.test_settings
.\.venv\Scripts\python.exe manage.py check
.\.venv\Scripts\python.exe manage.py makemigrations --check --dry-run
.\.venv\Scripts\python.exe manage.py showmigrations
```

Tests use Django's test database and do not require a running Redis worker.
The fallback-cache test mocks Redis errors; it does not verify a live Redis
connection. Configure Redis and start Celery separately to verify scheduled
runtime processing.

## Production configuration reminders

Set `DJANGO_DEBUG=false`, a unique secret `SECRET_KEY`, and explicit
`ALLOWED_HOSTS` before deployment. With debug disabled, secure cookies,
HTTPS redirects, and HSTS are enabled by default; set these options deliberately
if TLS terminates at a reverse proxy. Configure `CORS_ALLOWED_ORIGINS` with
only the actual trusted frontend origins. Review Django's deployment checklist
before exposing the service publicly. The current browser client stores JWTs
in `sessionStorage`; protect the app against cross-site scripting and reassess
token storage before production use. Production email uses SMTP settings;
development mode uses Django's console email backend. HSTS preload remains
disabled by default because enabling preload requires a domain and TLS setup
that meet the browser preload policy.
