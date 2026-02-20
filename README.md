# FitTrack (5007CEM Web Development)

Flask + MySQL fitness tracking system with user/admin roles,
secure auth, workout management, and progress analytics.

## Teacher / Checker Run Guide

### Important

- Run the project with `python app.py`.
- The app boot process automatically creates the target database (if missing), applies migrations, and seeds demo data in development mode.
- You do **not** need to manually create schema/tables by hand.

## Prerequisites

- Python 3.11+
- Local MySQL server running
- A MySQL account with permission to create/use databases

## Quick Start (Recommended)

1. Create virtual environment.

```powershell
python -m venv venv
```

1. Activate environment.

```powershell
venv\Scripts\Activate.ps1
```

If PowerShell blocks activation:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
venv\Scripts\Activate.ps1

1. Install dependencies.

```powershell
python -m pip install -r requirements.txt
```

1. Set DB environment variables (example).

```powershell
$env:DB_USER="root"
$env:DB_PASSWORD="root"
$env:DB_HOST="localhost"
$env:DB_PORT="3306"
$env:DB_NAME="fittrack"
```

1. Run app.

```powershell
python app.py
```

1. Open `http://127.0.0.1:5000/`.

## Alternative Start Script

You can also use:

```powershell
.\run_local.ps1
```

This script validates env vars, creates DB if needed, runs migrations, then starts `app.py`.

## Demo Credentials

### Admin

- REMEMBER!!! There is only one ADMIN

### Admin's Data

- Name: `FitAdmin`
- Email: `admin@fittrack.com`
- Password: `SuperSecret123`

### Demo Users

- Password for all demo users: `StrongPass123`
- `student@example.com`
- `coventry@gmail.com`
- `alex.runner@fittrack.demo`
- `maya.lift@fittrack.demo`

## Verification Checklist

1. Home page: `http://127.0.0.1:5000/`
1. Admin login: `http://127.0.0.1:5000/admin-login`
1. Admin dashboard: `http://127.0.0.1:5000/admin` (check "Today’s Snapshot")
1. User login: `http://127.0.0.1:5000/login`
1. User dashboard: `http://127.0.0.1:5000/user`
1. Weekly charts on user page support previous/next week navigation.
1. Home "Today’s Snapshot" supports previous/next week navigation (Mon-Sun week windows).

## Tests

Tests require a dedicated MySQL test database URL:

```powershell
$env:TEST_DATABASE_URL="mysql+pymysql://root:root@localhost:3306/fittrack_test"
python -m unittest discover -s tests -v
```

## Security Controls Implemented

- CSRF protection for form/API state-changing requests
- Role-based authorization for user/admin routes
- Input validation and sanitization rules
- Password hashing
- Login failure lockout protection
- Session protections and secure headers (CSP, X-Frame-Options, etc.)

## Troubleshooting

- `Access denied for user ...`: verify `DB_USER` / `DB_PASSWORD` / `DB_HOST` / `DB_PORT`.
- `TEST_DATABASE_URL is required`: set it before running tests.
- UI not updating after code changes: restart `python app.py` and hard refresh browser (`Ctrl+F5`).
- Port `5000` busy: stop old Python process and rerun.

## Submission Structure

- `app.py`
- `config.py`
- `templates/`
- `static/`
- `migrations/`
- `tests/`
- `requirements.txt`
- `.env.example`
