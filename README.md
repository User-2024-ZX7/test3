# FitTrack (5007CEM Web Development)

FitTrack is a Flask + Jinja2 + MySQL web application for tracking workouts, calories, and progress with role-based access for users and admins.

## Stack
- Backend: Flask, SQLAlchemy
- Frontend: Jinja2 templates, Bootstrap 5, ES6 JavaScript, Chart.js
- Database: MySQL (PyMySQL driver)

## Core Features
- Secure user registration/login with hashed passwords
- Separate admin login and role-based route protection
- Workout CRUD with archive/restore
- User dashboard with charts and filtering
- Admin dashboard with aggregated user statistics and account management
- CSV/JSON import, CSV/PDF export

## Security Controls
- CSRF protection for form and API POST requests
- Role-based authorization checks on user/admin routes
- Input validation for emails/passwords/workout payloads
- Login failure lockout for brute-force mitigation
- Logout uses CSRF-protected `POST` only
- Security headers (CSP, X-Frame-Options, Referrer-Policy, etc.)
- Session hardening (HttpOnly, SameSite, secure option via env)

## Run Locally
1. Create venv: `python -m venv venv`
2. Activate environment: `venv\Scripts\Activate.ps1`
3. Install deps: `pip install -r requirements.txt`
4. Set DB credentials: `DB_USER`, `DB_PASSWORD` (optional overrides: `DB_HOST`, `DB_PORT`, `DB_NAME`)
5. Start server: `python app.py` (auto-creates DB + applies migrations on startup)
6. Open: `http://127.0.0.1:5000`

### Stable Local Start (recommended on Windows)
Use `run_local.ps1` to auto-stop stale Python listeners on port `5000`, auto-create the MySQL database (if missing), run migrations, and start one server process.
- Copy `.env.example` to `.env` and set `DB_USER` and `DB_PASSWORD` once.
- `.\run_local.ps1`
- For assessment checks: this script is the intended single-command startup.

## Default Admin
- Email: `admin@fittrack.com`
- Name: `FitAdmin`
- Password: `SuperSecret123`

## Tests
Run security/role smoke tests:
- `python -m unittest discover -s tests -v`
- Includes integration flow test: user login -> workout create -> admin archive.

## Database Migrations
- Initialized Alembic/Flask-Migrate scaffolding in `migrations/`
- Initial revision: `migrations/versions/15722b83e2fa_initial_schema.py`
- Identity-to-username cleanup revision: `migrations/versions/8b7e1e3a2f6c_identity_columns_to_username.py`
- Apply migrations: `python -m flask --app app db upgrade`
- Runtime schema mutation is intentionally disabled; use migrations for schema changes.

## Final Production Structure
- Active app path only: `templates/`, `static/`, `app.py`, `config.py`, `migrations/`, `tests/`

## Development Authenticity
This project was developed incrementally in GitHub through regular commits across backend, frontend, database migrations, security controls, and tests. The history reflects staged implementation and cleanup work rather than a single final code dump. Final code validation was run on MySQL with passing automated tests.
