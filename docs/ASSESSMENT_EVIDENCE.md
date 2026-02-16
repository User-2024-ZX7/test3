# Assessment Evidence (5007CEM)

## Criterion 1: Security (20%)
- Password hashing: `generate_password_hash` / `check_password_hash` in `app.py`
- CSRF middleware: `enforce_csrf()` in `app.py`
- Role checks: admin/user gatekeeping on protected routes
- Account lockout controls: failed attempts + temporary lock
- Logout hardened to CSRF-protected `POST` route only
- Security headers: CSP, X-Frame-Options, Referrer-Policy, Permissions-Policy

## Criterion 2: HTML5 (20%)
- Template-driven HTML5 pages under `templates/`
- Label/input association and table caption improvements
- Semantic sections (`nav`, `header`, `main`, `section`, `footer`) used in primary pages

## Criterion 3: CSS3 + Bootstrap (20%)
- Bootstrap-based responsive layout on all core pages
- Dedicated CSS modules in `static/css/`
- Mobile breakpoints in `index.css`, `dashboard.css`, `admin.css`, `user.css`

## Criterion 4: Data/MySQL (20%)
- Flask-Migrate revision history in `migrations/` (initial schema revision committed)
- SQLAlchemy models for users, workouts, goals, summaries, logs, settings
- MySQL connection via `SQLALCHEMY_DATABASE_URI` in `config.py`
- Route-level DB writes for all user/admin actions
- Runtime `ALTER TABLE` logic removed; schema changes are migration-managed
- Runtime `db.create_all()` schema path removed; Alembic is the schema source of truth
- Added workout indexes for query efficiency:
  - `idx_workout_user_date`
  - `idx_workout_user_archived`
  - `idx_workout_activity`

## Criterion 5: Functionality (20%)
- Registration/login/admin login flows
- User workout logging and history
- Charts for weekly progress
- Search/filter by activity/date
- Admin aggregates and user account actions
- Import/export capabilities and audit logging
- One production path for marker clarity (legacy duplicates archived under `archive/legacy_2026-02-13/`)

## Automated Verification
- `tests/test_security_and_roles.py` + `tests/test_integration_flow.py` (20 tests total) cover CSRF, role restrictions, auth flow, hashing, admin lifecycle, API validation, secure logout, and end-to-end integration flow.
