# FitTrack (5007CEM Web Development)

Flask + MySQL fitness tracking system with user/admin roles, secure authentication, workout management, and dashboard analytics.

## Github account/repository link

https://github.com/User-2024-ZX7/test3

## Quick Start for Marker (Windows / PowerShell)

The project is designed to run with `python app.py`.

On startup, the app:

- Creates the target MySQL database if missing.
- Applies migrations.
- Seeds demo data in development mode.

You do **not** need to create tables manually.

### 1. Prerequisites

- Python 3.11+
- Local MySQL server running
- MySQL user with permission to create/use databases

### 2. Create and activate virtual environment

```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
```

If PowerShell blocks activation:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\venv\Scripts\Activate.ps1
```

### 3. Install dependencies

```powershell
python -m pip install -r requirements.txt
```

If your MySQL auth plugin requires crypto support (for example `caching_sha2_password` errors), run:

```powershell
python -m pip install cryptography
```

### 4. Set environment variables (example)

```powershell
$env:DB_USER="root"
$env:DB_PASSWORD="root"
$env:DB_HOST="localhost"
$env:DB_PORT="3306"
$env:DB_NAME="fittrack"
```

Optional:

```powershell
$env:SECRET_KEY="replace-with-random-secret"
$env:FITTRACK_SEED_DEMO="1"
```

### 5. Run

```powershell
python app.py
```

Open: `http://127.0.0.1:5000/`

## Alternative Start Script

```powershell
.\run_local.ps1
```

This script validates environment variables, ensures DB readiness, applies migrations, then starts the app.

## Demo Accounts (Development/Marking Only)

These credentials are for reproducible coursework demos only, not production.

### Admin

- Name: `FitAdmin`
- Email: `admin@fittrack.com`
- Password: `SuperSecret123`

### Demo Users

- Password for all demo users: `StrongPass123`
- `student@example.com`
- `coventry@gmail.com`
- `alex.runner@fittrack.demo`
- `maya.lift@fittrack.demo`

## Production Safety Note

Disable demo seeding outside development:

```powershell
$env:FITTRACK_SEED_DEMO="0"
```

Also use a strong `SECRET_KEY` and real production DB credentials.

## Verification Checklist

1. Home page: `http://127.0.0.1:5000/`
2. Admin login: `http://127.0.0.1:5000/admin-login`
3. Admin dashboard: `http://127.0.0.1:5000/admin`
4. User login: `http://127.0.0.1:5000/login`
5. User dashboard: `http://127.0.0.1:5000/user`
6. Weekly charts support previous/next week navigation.
7. Home snapshot supports Mon-Sun week window navigation.

## Running Tests

Tests require a dedicated MySQL test database:

```powershell
$env:TEST_DATABASE_URL="mysql+pymysql://root:root@localhost:3306/fittrack_test"
python -m unittest discover -s tests -v
```

## Security Controls Implemented

- CSRF protection for state-changing requests
- Role-based route authorization (`user` vs `admin`)
- Input validation and sanitization
- Password hashing
- Login lockout on repeated failures
- Session validation and secure response headers (CSP, X-Frame-Options, etc.)

## Troubleshooting

- `Access denied for user ...`: verify `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT`.
- `No suitable Python runtime found`: run `py -0p` to list installed versions, then create venv with an available version (for example `py -3.12 -m venv .venv`).
- `.\venv\Scripts\Activate.ps1 not recognized`: the copied `venv` may be invalid on your machine. Recreate it locally, then activate (`.\.venv\Scripts\Activate.ps1`).
- MySQL auth/SSL crypto errors from PyMySQL: install `cryptography` (`python -m pip install cryptography`).
- `TEST_DATABASE_URL is required`: set it before running tests.
- UI not updating: restart app and hard refresh (`Ctrl+F5`).
- Port `5000` busy: stop old Python process and rerun.

## Submission Structure

- `app.py`
- `config.py`
- `templates/`
- `static/`
- `migrations/`
- `tests/`
- `requirements.txt`
- `README.md`
- `.env.example`
