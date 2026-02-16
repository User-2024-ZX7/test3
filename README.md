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
1. Activate environment: `venv\Scripts\Activate.ps1`
2. Install deps: `pip install -r requirements.txt`
3. Configure env vars (optional): `SECRET_KEY`, `DATABASE_URL`, `DB_*`
4. Apply migrations: `python -m flask --app app db upgrade`
5. Start server: `python app.py`
6. Open: `http://127.0.0.1:5000`

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
