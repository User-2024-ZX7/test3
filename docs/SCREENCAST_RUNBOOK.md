# Screencast Runbook (Professional, Evidence-Led)

## Goal
Produce a 10-12 minute screencast that explicitly proves every rubric criterion with live, repeatable evidence.
Use this together with `docs/SCREENCAST_EVIDENCE_PACK.md`.

## Setup (before recording)
1. Activate env: `venv\Scripts\Activate.ps1`
2. Install deps: `pip install -r requirements.txt`
3. Start app: `python app.py`
4. Open browser at `http://127.0.0.1:5000`
5. Keep terminal visible for test outputs.

## Timecoded Script

### 00:00 - 00:45 Intro
- State project title, module, and student ID.
- Explain stack: Flask, Jinja2, Bootstrap, MySQL, ES6 JS.

### 00:45 - 02:30 Security Evidence (Criterion 1)
- Show `app.py` sections:
  - CSRF middleware: `enforce_csrf()`
  - Security headers: `add_security_headers()`
  - Login lockout helpers
- Run tests live:
  - `python -m unittest discover -s tests -v`
- Explain passed tests proving:
  - CSRF enforcement
  - Role access restrictions
  - Password hashing behavior

### 02:30 - 04:00 HTML5 + Accessibility (Criterion 2)
- Show templates using semantic structure (`nav`, `main`, `section`, `footer`).
- Show explicit label-to-input bindings and table caption accessibility.
- Demonstrate keyboard tab navigation briefly.

### 04:00 - 05:30 CSS3 + Responsive (Criterion 3)
- Demonstrate mobile, tablet, desktop breakpoints in browser responsive mode.
- Show Bootstrap grid behavior and custom CSS modules.
- Confirm consistent branding/buttons across pages.

### 05:30 - 07:30 Data + MySQL (Criterion 4)
- Show model layer in `app.py` and migration evidence in `migrations/`.
- Show migration file: `migrations/versions/15722b83e2fa_initial_schema.py`.
- Explain indexed query strategy for workout-heavy endpoints.
- Optionally run DB route interaction live and refresh admin/user views.

### 07:30 - 10:00 Functionality End-to-End (Criterion 5)
- Register a user -> login -> add workouts -> chart updates.
- Search/filter activity history.
- Export CSV / import JSON or CSV.
- Admin login -> view aggregates -> archive/restore/delete user.
- Show role separation: user cannot access admin routes.

### 10:00 - 11:00 LO Mapping Summary
- Open `docs/LO_MAPPING.md` and summarize LO1-LO5 evidence quickly.

### 11:00 - 12:00 Conclusion
- Open `docs/ASSESSMENT_EVIDENCE.md` and recap criterion-by-criterion proof.
- State test pass result and migration/versioning evidence.

## Minimum Live Evidence to Capture
- A full visible terminal run of `python -m unittest discover -s tests -v`.
- Browser proof of:
  - user blocked from `/admin`
  - admin access to `/admin`
  - workout create + archive/restore reflected in UI
- File proof of migration revision and index rationale.

## Recording Quality Checklist
- Keep terminal and browser readable (>=125% zoom if needed).
- Show command output fully after each command.
- Narrate why each demo proves a rubric item.
- Avoid dead air: follow the exact sequence above.
