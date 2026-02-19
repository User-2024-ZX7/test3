# FitTrack (5007CEM Web Development)

FitTrack is a Flask + Jinja2 + MySQL web app for logging workouts, tracking calories, and viewing progress with role-based access for users and admins.

## Stack

- Backend: Flask, SQLAlchemy, Flask-Migrate
- Frontend: Jinja2, Bootstrap 5, ES6 JavaScript, Chart.js
- Database: MySQL (`mysql+pymysql`)

## Features Implemented

- User registration/login with hashed passwords
- Admin login with role-based route protection
- Workout CRUD with archive/restore
- User dashboard with search/filter and charts
- Admin dashboard with aggregated statistics and account management
- CSV/JSON import log and CSV/PDF export support

## Security Controls

- CSRF protection for form and API `POST` requests
- Role-based authorization checks on user/admin routes
- Input validation for auth, workout, and settings payloads
- Login failure lockout protection
- Logout by CSRF-protected `POST` only
- Security headers (CSP, X-Frame-Options, Referrer-Policy, etc.)
- Session hardening (HttpOnly, SameSite, configurable Secure cookie)

## Checker Quick Start (Recommended)

Prerequisites:

- Python 3.11+
- MySQL server running locally
- MySQL user with permission to create/use databases
- MySQL CLI in `PATH` (recommended for `run_local.ps1`)

Steps:

1. `python -m venv venv`
2. `venv\Scripts\Activate.ps1`
3. `python -m pip install -r requirements.txt`
4. Copy `.env.example` to `.env` and set `DB_USER` and `DB_PASSWORD`
5. Run `.\run_local.ps1`
6. Open `http://127.0.0.1:5000`

What startup does automatically:

- Creates DB (if missing)
- Applies Alembic migrations
- Seeds deterministic demo users/workouts in development mode

## Manual Start (Fallback)

```powershell
$env:DB_USER="fittrack_user"
$env:DB_PASSWORD="<your_mysql_password>"
$env:DB_HOST="localhost"
$env:DB_PORT="3306"
$env:DB_NAME="fittrack"
python app.py
```

If local MySQL only has `root`, replace `fittrack_user` with `root` for local development.

## Verification URLs

- Home: `http://127.0.0.1:5000/`
- User login: `http://127.0.0.1:5000/login`
- Admin login: `http://127.0.0.1:5000/admin-login`
- User dashboard (after login): `http://127.0.0.1:5000/user`
- Admin dashboard (after login): `http://127.0.0.1:5000/admin`

## Default Admin Account

- Email: `admin@fittrack.com`
- Name: `FitAdmin`
- Password: `SuperSecret123`

## Demo Seed Data

- Enabled by default in development mode
- Demo user password: `StrongPass123`
- Demo users:
  - `student@example.com`
  - `coventry@gmail.com`
  - `alex.runner@fittrack.demo`
  - `maya.lift@fittrack.demo`
- Disable with: `FITTRACK_SEED_DEMO=0`

## Tests

Set test DB URL first:

```powershell
$env:TEST_DATABASE_URL="mysql+pymysql://fittrack_user:<your_mysql_password>@localhost:3306/fittrack_test"
```

Run:

- `python -m unittest discover -s tests -v`

Test suite includes security/role coverage and integration flow.

## Database Migrations

- Migrations are in `migrations/`
- Apply manually (if needed): `python -m flask --app app db upgrade`
- Runtime schema mutation is disabled; schema changes must go through migrations

## Active Submission Structure

- `app.py`
- `config.py`
- `templates/`
- `static/`
- `migrations/`
- `tests/`
- `requirements.txt`
- `.env.example`
