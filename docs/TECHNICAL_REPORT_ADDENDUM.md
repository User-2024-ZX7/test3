# Technical Report Addendum

## 1. Design Tradeoffs
- Monolith Flask structure was kept intentionally for assessment clarity and faster traceability of features-to-routes.
- Server-rendered Jinja2 templates were preferred over SPA complexity to match module constraints and reduce deployment risk.
- A lightweight SSE heartbeat was used for "live" updates; interval was throttled by role to reduce admin dashboard lag under heavier aggregation load.
- Import/export support prioritized CSV/JSON interoperability and reproducibility over richer but non-essential formats.
- Runtime schema mutation was removed from request startup; schema evolution is controlled via Alembic migrations for deterministic deployments.

## 2. Security Decisions
- Passwords are stored only as hashes (`werkzeug.security`) and never persisted in plaintext.
- CSRF validation is applied centrally at middleware level to cover both form submits and JS API calls.
- Role-based route checks are enforced server-side for all protected endpoints (`user` vs `admin`).
- Brute-force risk is mitigated with failed-login tracking and temporary account lock windows.
- Response headers harden the app surface:
  - CSP
  - X-Frame-Options
  - Referrer-Policy
  - Permissions-Policy
  - Cache controls for authenticated/API paths
- Session fixation risk is reduced by regenerating session state on successful login.
- Logout was changed to CSRF-protected `POST` only (no state-changing `GET`).

## 3. Query Optimization Rationale
- Workout table is queried frequently by user/date/activity and archive status.
- Added indexes target actual access patterns:
  - `idx_workout_user_date` for timeline/history loading
  - `idx_workout_user_archived` for active vs archived filters
  - `idx_workout_activity` for grouped statistics and frequency analysis
- Admin dashboard aggregation was refactored away from N+1 loops to grouped queries for per-user metrics.
- Daily summary and weekly goal tables pre-structure commonly viewed metrics to reduce repeated heavy scans during UI refresh.

## 4. Reliability and Evidence Strategy
- Formal migration scaffold (`migrations/`) added to provide schema versioning evidence.
- Automated test suite verifies core security/authorization behavior for repeatable assessor validation.
- Documentation package (`README`, `ASSESSMENT_EVIDENCE`, `LO_MAPPING`) maps implementation directly to rubric and learning outcomes.
x