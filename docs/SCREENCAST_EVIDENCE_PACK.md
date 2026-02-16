# Screencast Evidence Pack

Use this as the on-screen proof sequence while recording.

## 1) Security (20%)
- Show `app.py`:
  - `enforce_csrf()`
  - `add_security_headers()`
  - login lockout helpers (`_register_login_failure`, `_is_user_locked`)
  - `POST`-only logout route (`/logout`)
- Run:
  - `python -m unittest discover -s tests -v`
- Keep the terminal visible to show passing tests for CSRF, role access, password hashing, admin lifecycle, and API validation.

## 2) HTML5 (20%)
- Open:
  - `templates/index.html`
  - `templates/login.html`
  - `templates/admin.html`
- Point to semantic tags (`nav`, `main`, `section`, `footer`) and explicit form labels.

## 3) CSS3 + Bootstrap (20%)
- Open responsive mode in browser dev tools.
- Demonstrate mobile/tablet/desktop on:
  - `/`
  - `/login`
  - `/user`
  - `/admin`
- Show shared design tokens in:
  - `static/css/branding.css`
  - `static/css/admin-buttons.css`

## 4) Data/MySQL (20%)
- Show schema versioning:
  - `migrations/versions/15722b83e2fa_initial_schema.py`
- Show DB-backed writes:
  - register user
  - add workout
  - archive/restore workout
  - admin archive/restore/delete user
- Show index strategy in `create_tables()`:
  - `idx_workout_user_date`
  - `idx_workout_user_archived`
  - `idx_workout_activity`

## 5) Functionality (20%)
- User flow: register -> login -> add workouts -> chart/history updates.
- Admin flow: `/admin-login` -> `/admin` -> view aggregated stats -> manage users.
- Show role boundaries:
  - user blocked from `/admin`
  - unauthenticated blocked from `/api/workouts`

## Live Commands to Show
- `python -m unittest discover -s tests -v`
- `python -m flask --app app routes`
- `python -m flask --app app db current`

## Close with
- `docs/ASSESSMENT_EVIDENCE.md`
- `docs/LO_MAPPING.md`
- `docs/TECHNICAL_REPORT_ADDENDUM.md`
