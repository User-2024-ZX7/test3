from flask import Flask, g, render_template, redirect, url_for, request, flash, session, jsonify, Response
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import case, func, inspect, text
from werkzeug.security import generate_password_hash, check_password_hash
from config import Config
import json
import os
import re
import time
from datetime import date, datetime, timedelta
from secrets import token_urlsafe

try:
    from flask_migrate import Migrate
except ImportError:
    Migrate = None

app = Flask(__name__)
app.config.from_object(Config)
db = SQLAlchemy(app)
if Migrate:
    migrate = Migrate(app, db)

EMAIL_RE = re.compile(r'^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$')
LANGUAGE_RE = re.compile(r'^[A-Za-z]{2,8}(?:-[A-Za-z]{2,8})?$')
MAX_FAILED_LOGIN_ATTEMPTS = 5
LOGIN_LOCK_MINUTES = 15


def _clean_text(value, max_len=None):
    txt = (value or '').strip()
    if max_len is not None:
        return txt[:max_len]
    return txt


def _clean_email(value):
    return _clean_text(value, 150).lower()


def _is_valid_email(email):
    return bool(email and EMAIL_RE.match(email))


def _is_valid_username(username):
    if len(username) < 3 or len(username) > 150:
        return False
    if '<' in username or '>' in username:
        return False
    return True


def _is_strong_password(password):
    if not password or len(password) < 8 or len(password) > 128:
        return False
    has_upper = any(c.isupper() for c in password)
    has_lower = any(c.islower() for c in password)
    has_digit = any(c.isdigit() for c in password)
    return has_upper and has_lower and has_digit


def _parse_bool(value):
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        val = value.strip().lower()
        if val in ('1', 'true', 'yes', 'on'):
            return True
        if val in ('0', 'false', 'no', 'off'):
            return False
    return None


def _is_valid_activity(activity):
    if len(activity) < 2 or len(activity) > 100:
        return False
    if '<' in activity or '>' in activity:
        return False
    return True


def _get_csp_nonce():
    nonce = getattr(g, 'csp_nonce', None)
    if not nonce:
        nonce = token_urlsafe(16)
        g.csp_nonce = nonce
    return nonce


def _is_user_locked(user):
    return bool(user and user.locked_until and user.locked_until > datetime.utcnow())


def _lock_minutes_remaining(user):
    if not user or not user.locked_until:
        return 0
    remaining = user.locked_until - datetime.utcnow()
    return max(0, int(remaining.total_seconds() // 60) + 1)


def _register_login_failure(user):
    if not user:
        return
    user.failed_attempts = (user.failed_attempts or 0) + 1
    if user.failed_attempts >= MAX_FAILED_LOGIN_ATTEMPTS:
        user.locked_until = datetime.utcnow() + timedelta(minutes=LOGIN_LOCK_MINUTES)
        user.failed_attempts = 0


def _clear_login_failures(user):
    if not user:
        return
    user.failed_attempts = 0
    user.locked_until = None


def _validate_runtime_config():
    if os.environ.get('FLASK_ENV', '').lower() != 'production':
        return
    if not os.environ.get('SECRET_KEY'):
        raise RuntimeError('SECRET_KEY must be set in production.')
    if not os.environ.get('DATABASE_URL'):
        raise RuntimeError('DATABASE_URL must be set in production.')
    app.config['SESSION_COOKIE_SECURE'] = True


_validate_runtime_config()


@app.after_request
def add_security_headers(response):
    response.headers.setdefault('X-Content-Type-Options', 'nosniff')
    response.headers.setdefault('X-Frame-Options', 'SAMEORIGIN')
    response.headers.setdefault('Referrer-Policy', 'strict-origin-when-cross-origin')
    response.headers.setdefault('Permissions-Policy', 'geolocation=(), microphone=(), camera=()')
    response.headers.setdefault(
        'Content-Security-Policy',
        "default-src 'self'; "
        f"script-src 'self' 'nonce-{_get_csp_nonce()}' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://unpkg.com; "
        "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://unpkg.com https://fonts.googleapis.com; "
        "font-src 'self' https://cdnjs.cloudflare.com https://fonts.gstatic.com data:; "
        "img-src 'self' data: https:; "
        "connect-src 'self'; "
        "frame-ancestors 'self'; "
        "base-uri 'self';"
    )
    if request.is_secure:
        response.headers.setdefault('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
    if request.path.startswith('/api/') or 'user_id' in session:
        response.headers['Cache-Control'] = 'no-store'
    return response


def _get_csrf_token():
    token = session.get('csrf_token')
    if not token:
        token = token_urlsafe(32)
        session['csrf_token'] = token
    return token


@app.context_processor
def inject_csrf_token():
    return {'csrf_token': _get_csrf_token, 'csp_nonce': _get_csp_nonce}


def _wants_json_response():
    accept = request.headers.get('Accept', '')
    return (
        'application/json' in accept
        or request.is_json
        or request.path.startswith('/api/')
        or request.path.startswith('/workouts')
        or request.path.startswith('/admin/users')
    )


@app.before_request
def enforce_csrf():
    if request.method not in ('POST', 'PUT', 'PATCH', 'DELETE'):
        return None

    sent_token = request.headers.get('X-CSRFToken') or request.form.get('csrf_token')
    stored_token = session.get('csrf_token')
    if not stored_token or not sent_token or sent_token != stored_token:
        if _wants_json_response():
            return jsonify({'error': 'csrf_token_invalid'}), 400
        flash('Security token invalid. Please refresh and try again.', 'danger')
        return redirect(request.referrer or url_for('index'))
    return None


@app.before_request
def enforce_session_identity():
    # Prevent 500s from stale cookies pointing to deleted/changed accounts.
    user_id = session.get('user_id')
    role = session.get('role')
    if not user_id or role not in ('user', 'admin'):
        return None

    current_user = db.session.get(User, user_id)
    session_invalid = (
        not current_user
        or current_user.role != role
        or (role == 'user' and current_user.is_archived)
    )
    if not session_invalid:
        return None

    session.clear()
    if request.path.startswith('/api/') or request.path.startswith('/admin/'):
        return jsonify({'error': 'session_invalid'}), 401

    flash('Your session expired. Please log in again.', 'warning')
    if role == 'admin':
        return redirect(url_for('admin_login'))
    return redirect(url_for('login'))

# -------------------- MODELS --------------------
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(150), nullable=False)
    email = db.Column(db.String(150), unique=True, nullable=False)
    password = db.Column(db.String(200), nullable=False)
    role = db.Column(db.String(50), nullable=False, default='user')
    failed_attempts = db.Column(db.Integer, nullable=False, default=0)
    locked_until = db.Column(db.DateTime, nullable=True)
    is_archived = db.Column(db.Boolean, nullable=False, default=False)
    avatar_url = db.Column(db.Text, nullable=True)
    workouts = db.relationship('Workout', backref='user', lazy=True)

workout_tag = db.Table(
    'workout_tag',
    db.Column('workout_id', db.Integer, db.ForeignKey('workout.id'), primary_key=True),
    db.Column('tag_id', db.Integer, db.ForeignKey('activity_tag.id'), primary_key=True),
)

class Workout(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    username = db.Column(db.String(150), nullable=True)
    activity = db.Column(db.String(100), nullable=False)
    duration = db.Column(db.Integer, nullable=False)
    calories = db.Column(db.Integer, nullable=False)
    date = db.Column(db.Date, nullable=False)
    archived = db.Column(db.Boolean, nullable=False, default=False)
    tags = db.relationship('ActivityTag', secondary=workout_tag, backref=db.backref('workouts', lazy='dynamic'))
    __table_args__ = (
        db.Index('idx_workout_user_date', 'user_id', 'date'),
        db.Index('idx_workout_user_archived', 'user_id', 'archived'),
        db.Index('idx_workout_activity', 'activity'),
    )

class ActivityTag(db.Model):
    __tablename__ = 'activity_tag'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(60), unique=True, nullable=False)

class DailySummary(db.Model):
    __tablename__ = 'daily_summary'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    username = db.Column(db.String(150), nullable=True)
    summary_date = db.Column(db.Date, nullable=False)
    total_workouts = db.Column(db.Integer, nullable=False, default=0)
    total_calories = db.Column(db.Integer, nullable=False, default=0)
    total_duration = db.Column(db.Integer, nullable=False, default=0)
    __table_args__ = (db.UniqueConstraint('user_id', 'summary_date', name='uniq_user_day'),)

class WeeklyGoal(db.Model):
    __tablename__ = 'weekly_goal'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False, unique=True)
    username = db.Column(db.String(150), nullable=True)
    goal_workouts = db.Column(db.Integer, nullable=False, default=10)
    goal_calories = db.Column(db.Integer, nullable=False, default=4000)
    goal_minutes = db.Column(db.Integer, nullable=False, default=150)
    updated_at = db.Column(db.DateTime, nullable=False, server_default=func.now(), onupdate=func.now())

class AdminAuditLog(db.Model):
    __tablename__ = 'admin_audit_log'
    id = db.Column(db.Integer, primary_key=True)
    admin_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    username = db.Column(db.String(150), nullable=True)
    target_user_id = db.Column(db.Integer, nullable=True)
    action = db.Column(db.String(80), nullable=False)
    details = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, server_default=func.now())

class ImportExportHistory(db.Model):
    __tablename__ = 'import_export_history'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    username = db.Column(db.String(150), nullable=True)
    action = db.Column(db.String(10), nullable=False)  # import / export
    file_format = db.Column(db.String(10), nullable=False)  # csv / json / pdf
    records = db.Column(db.Integer, nullable=False, default=0)
    filename = db.Column(db.String(200), nullable=True)
    status = db.Column(db.String(20), nullable=False, default='ok')
    error_message = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, server_default=func.now())

class UserSettings(db.Model):
    __tablename__ = 'user_settings'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False, unique=True)
    username = db.Column(db.String(150), nullable=True)
    language = db.Column(db.String(20), nullable=False, default='en')
    units = db.Column(db.String(10), nullable=False, default='metric')
    theme = db.Column(db.String(20), nullable=False, default='light')
    notifications = db.Column(db.Boolean, nullable=False, default=True)

# -------------------- DATABASE INIT --------------------
@app.before_first_request
def initialize_seed_data():
    # Schema evolution is handled by Alembic migrations only.
    inspector = inspect(db.engine)
    required_tables = ('user', 'user_settings', 'weekly_goal')
    missing_tables = [t for t in required_tables if not inspector.has_table(t)]
    if missing_tables:
        raise RuntimeError(
            f"Database is not migrated. Missing tables: {', '.join(missing_tables)}. "
            "Run: python -m flask --app app db upgrade"
        )

    # Ensure admin exists
    admin = User.query.filter_by(email='admin@fittrack.com').first()
    if not admin:
        hashed_pw = generate_password_hash('SuperSecret123')
        admin = User(
            username='FitAdmin',
            email='admin@fittrack.com',
            password=hashed_pw,
            role='admin'
        )
        db.session.add(admin)

    # Ensure settings and weekly goals exist for all users
    try:
        for u in User.query.all():
            settings = UserSettings.query.filter_by(user_id=u.id).first()
            if not settings:
                db.session.add(UserSettings(user_id=u.id, username=u.username))
            elif not settings.username:
                settings.username = u.username

            goal = WeeklyGoal.query.filter_by(user_id=u.id).first()
            if u.role != 'admin' and not goal:
                db.session.add(WeeklyGoal(user_id=u.id, username=u.username))
            elif u.role != 'admin' and not goal.username:
                goal.username = u.username
        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        raise RuntimeError('Failed to initialize seed data. Apply migrations and retry.') from exc

# -------------------- HELPERS --------------------
def normalize_tags(raw):
    if not raw:
        return []
    if isinstance(raw, list):
        items = raw
    else:
        items = re.split(r'[;,]+', str(raw))
    cleaned = []
    for item in items:
        name = str(item).strip().lower()
        if '<' in name or '>' in name:
            continue
        if name:
            cleaned.append(name[:60])
    seen = set()
    result = []
    for name in cleaned:
        if name in seen:
            continue
        seen.add(name)
        result.append(name)
    return result

def get_or_create_tags(tag_names):
    if not tag_names:
        return []
    existing = ActivityTag.query.filter(ActivityTag.name.in_(tag_names)).all()
    by_name = {t.name: t for t in existing}
    for name in tag_names:
        if name not in by_name:
            tag = ActivityTag(name=name)
            db.session.add(tag)
            by_name[name] = tag
    return [by_name[name] for name in tag_names]

def recalc_daily_summary(user_id, summary_date):
    totals = db.session.query(
        func.count(Workout.id),
        func.sum(Workout.calories),
        func.sum(Workout.duration)
    ).filter_by(user_id=user_id, archived=False, date=summary_date).first()

    total_workouts = int(totals[0] or 0)
    total_calories = int(totals[1] or 0)
    total_duration = int(totals[2] or 0)

    summary = DailySummary.query.filter_by(user_id=user_id, summary_date=summary_date).first()
    user = db.session.get(User, user_id)
    username = user.username if user else None
    if total_workouts == 0:
        if summary:
            db.session.delete(summary)
        return
    if not summary:
        summary = DailySummary(user_id=user_id, username=username, summary_date=summary_date)
        db.session.add(summary)
    elif username and summary.username != username:
        summary.username = username
    summary.total_workouts = total_workouts
    summary.total_calories = total_calories
    summary.total_duration = total_duration

def log_admin_action(action, target_user_id=None, meta=None):
    if session.get('role') != 'admin':
        return
    admin_user = db.session.get(User, session.get('user_id'))
    details = json.dumps(meta, ensure_ascii=False) if meta else None
    entry = AdminAuditLog(
        admin_id=session.get('user_id'),
        username=admin_user.username if admin_user else None,
        target_user_id=target_user_id,
        action=action,
        details=details
    )
    db.session.add(entry)

def log_import_export(user_id, action, file_format, records=0, filename=None, status='ok', error_message=None):
    user = db.session.get(User, user_id)
    entry = ImportExportHistory(
        user_id=user_id,
        username=user.username if user else None,
        action=action,
        file_format=file_format,
        records=int(records or 0),
        filename=filename,
        status=status,
        error_message=error_message
    )
    db.session.add(entry)


def _build_admin_user_stats(users):
    if not users:
        return []

    user_ids = [u.id for u in users]

    aggregate_rows = db.session.query(
        Workout.user_id.label('user_id'),
        func.sum(case((Workout.archived.is_(False), 1), else_=0)).label('active_count'),
        func.sum(case((Workout.archived.is_(True), 1), else_=0)).label('archived_count'),
        func.avg(Workout.calories).label('avg_cal'),
        func.avg(Workout.duration).label('avg_dur'),
    ).filter(
        Workout.user_id.in_(user_ids)
    ).group_by(
        Workout.user_id
    ).all()

    aggregate_map = {
        row.user_id: {
            'active_count': int(row.active_count or 0),
            'archived_count': int(row.archived_count or 0),
            'avg_cal': int(round(row.avg_cal)) if row.avg_cal else 0,
            'avg_dur': int(round(row.avg_dur)) if row.avg_dur else 0,
        }
        for row in aggregate_rows
    }

    frequent_rows = db.session.query(
        Workout.user_id.label('user_id'),
        Workout.activity.label('activity'),
        func.count(Workout.id).label('activity_count'),
    ).filter(
        Workout.user_id.in_(user_ids)
    ).group_by(
        Workout.user_id, Workout.activity
    ).order_by(
        Workout.user_id,
        func.count(Workout.id).desc(),
        Workout.activity.asc(),
    ).all()

    frequent_map = {}
    for row in frequent_rows:
        frequent_map.setdefault(row.user_id, row.activity)

    stats = []
    for user in users:
        aggregate = aggregate_map.get(user.id, {
            'active_count': 0,
            'archived_count': 0,
            'avg_cal': 0,
            'avg_dur': 0,
        })
        stats.append({
            'user': user,
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'active_count': aggregate['active_count'],
            'archived_count': aggregate['archived_count'],
            'avg_cal': aggregate['avg_cal'],
            'avg_dur': aggregate['avg_dur'],
            'freq_activity': frequent_map.get(user.id, '-'),
            'avatar_url': user.avatar_url,
        })
    return stats


def _get_admin_dashboard_payload():
    users_all = User.query.filter(User.role != 'admin').all()
    users = [u for u in users_all if not u.is_archived]
    archived_users = [u for u in users_all if u.is_archived]
    total_workouts = Workout.query.count()
    avg_calories = db.session.query(func.avg(Workout.calories)).scalar() or 0
    today = date.today()

    today_workouts = (
        Workout.query.filter(
            Workout.archived.is_(False),
            Workout.date == today,
        ).count()
    )
    today_calories = (
        db.session.query(func.sum(Workout.calories))
        .filter(
            Workout.archived.is_(False),
            Workout.date == today,
        )
        .scalar()
    ) or 0
    today_avg_calories = (
        db.session.query(func.avg(Workout.calories))
        .filter(
            Workout.archived.is_(False),
            Workout.date == today,
        )
        .scalar()
    ) or 0
    today_active_users = (
        db.session.query(func.count(func.distinct(Workout.user_id)))
        .join(User, User.id == Workout.user_id)
        .filter(
            Workout.archived.is_(False),
            Workout.date == today,
            User.role != 'admin',
            User.is_archived.is_(False),
        )
        .scalar()
    ) or 0

    return {
        'total_users': len(users),
        'total_workouts': total_workouts,
        'avg_calories': int(round(avg_calories)) if avg_calories else 0,
        'today_snapshot': {
            'date_iso': today.isoformat(),
            'active_users': int(today_active_users),
            'workouts': int(today_workouts),
            'calories': int(today_calories),
            'avg_calories': int(round(today_avg_calories)) if today_avg_calories else 0,
        },
        'user_stats': _build_admin_user_stats(users),
        'archived_users': archived_users,
    }
# -------------------- ROUTES --------------------
@app.route('/')
def index():
    return render_template('index.html')  # public landing page

# -------- LOGIN --------
@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        email = _clean_email(request.form.get('email'))
        password = request.form.get('password') or ''
        if not _is_valid_email(email) or not password:
            flash('Invalid email or password format.', 'danger')
            return redirect(url_for('login'))

        user = User.query.filter_by(email=email).first()
        if user and _is_user_locked(user):
            flash(f'Too many failed attempts. Try again in {_lock_minutes_remaining(user)} minute(s).', 'warning')
            return redirect(url_for('login'))

        if not user or not check_password_hash(user.password, password):
            if user:
                _register_login_failure(user)
                db.session.commit()
            flash('Incorrect email or password!', 'danger')
            return redirect(url_for('login'))

        _clear_login_failures(user)
        db.session.commit()

        if user.is_archived:
            flash('Account is archived. Contact admin.', 'warning')
            return redirect(url_for('login'))

        if user.role == 'admin':
            # Admin credentials are intentionally blocked on the user login endpoint.
            flash('Access denied! Use the admin login page for admin accounts.', 'admin_denied')
            return redirect(url_for('login'))

        # Regenerate session on login to reduce fixation risk.
        session.clear()
        session['user_id'] = user.id
        session['role'] = user.role
        session['csrf_token'] = token_urlsafe(32)
        session.permanent = True
        flash('Logged in successfully!', 'success')

        return redirect(url_for('user_dashboard'))

    return render_template('login.html')

# -------- ADMIN LOGIN --------
@app.route('/admin-login', methods=['GET', 'POST'])
def admin_login():
    if session.get('role') == 'admin':
        return redirect(url_for('admin_dashboard'))
    if request.method == 'POST':
        email = _clean_email(request.form.get('email'))
        admin_name = _clean_text(request.form.get('admin_name'), 150)
        password = request.form.get('password') or ''
        user = User.query.filter_by(email='admin@fittrack.com', role='admin').first()

        if user and _is_user_locked(user):
            flash(f'Too many failed attempts. Try again in {_lock_minutes_remaining(user)} minute(s).', 'warning')
            return redirect(url_for('admin_login'))

        if email != 'admin@fittrack.com':
            if user:
                _register_login_failure(user)
                db.session.commit()
            flash('Incorrect admin email or password!', 'danger')
            return redirect(url_for('admin_login'))
        if admin_name != 'FitAdmin':
            if user:
                _register_login_failure(user)
                db.session.commit()
            flash('Incorrect admin email or password!', 'danger')
            return redirect(url_for('admin_login'))

        if not user or not check_password_hash(user.password, password):
            if user:
                _register_login_failure(user)
                db.session.commit()
            flash('Incorrect admin email or password!', 'danger')
            return redirect(url_for('admin_login'))

        _clear_login_failures(user)
        db.session.commit()
        # Regenerate session on login to reduce fixation risk.
        session.clear()
        session['user_id'] = user.id
        session['role'] = user.role
        session['csrf_token'] = token_urlsafe(32)
        session.permanent = True
        flash('Logged in as admin!', 'success')
        return redirect(url_for('admin_dashboard'))

    return render_template('admin-login.html')

# Friendly redirects for static-style URLs
@app.route('/admin-login.html')
def admin_login_html():
    return redirect(url_for('admin_login'))

@app.route('/admin.html')
def admin_html():
    return redirect(url_for('admin_dashboard'))

@app.route('/login.html')
def login_html():
    return redirect(url_for('login'))

@app.route('/index.html')
def index_html():
    return redirect(url_for('index'))

@app.route('/register.html')
def register_html():
    return redirect(url_for('register'))

@app.route('/user.html')
def user_html():
    return redirect(url_for('user_dashboard'))

@app.route('/dashboard.html')
def dashboard_html():
    return redirect(url_for('user_dashboard'))

@app.route('/add_workout.html')
def add_workout_html():
    return redirect(url_for('user_dashboard'))

# -------- REGISTER --------
@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        username = _clean_text(request.form.get('username'), 150)
        email = _clean_email(request.form.get('email'))
        password = request.form.get('password') or ''
        confirm_password = request.form.get('confirm_password') or ''

        if not _is_valid_username(username):
            flash('Username must be 3-150 chars and cannot include < or >.', 'danger')
            return redirect(url_for('register'))
        if not _is_valid_email(email):
            flash('Please enter a valid email address.', 'danger')
            return redirect(url_for('register'))
        if not _is_strong_password(password):
            flash('Password must be 8+ chars with upper, lower, and number.', 'danger')
            return redirect(url_for('register'))

        if password != confirm_password:
            flash('Passwords do not match!', 'danger')
            return redirect(url_for('register'))

        if email == 'admin@fittrack.com':
            flash('This email is reserved for admins.', 'warning')
            return redirect(url_for('register'))

        existing = User.query.filter_by(email=email).first()
        if existing:
            if existing.is_archived:
                flash('This account is archived. Contact admin to restore it.', 'warning')
                return redirect(url_for('register'))
            flash('Email already registered!', 'warning')
            return redirect(url_for('register'))

        hashed_pw = generate_password_hash(password)
        user = User(
            username=username,
            email=email,
            password=hashed_pw,
            role='user'
        )
        db.session.add(user)
        db.session.flush()
        db.session.add(UserSettings(user_id=user.id, username=user.username))
        db.session.add(WeeklyGoal(user_id=user.id, username=user.username))
        db.session.commit()

        flash('Registration successful! Please log in.', 'success')
        return redirect(url_for('login'))

    return render_template('register.html')

# -------- LOGOUT --------
@app.route('/logout', methods=['POST'])
def logout():
    role = session.get('role')
    session.clear()
    flash('Logged out successfully.', 'info')
    if role == 'admin':
        return redirect(url_for('admin_login'))
    return redirect(url_for('login'))  # redirect to login after logout

# -------- DASHBOARDS --------
@app.route('/admin')
def admin_dashboard():
    if session.get('role') != 'admin':
        flash('Admin login required.', 'warning')
        return redirect(url_for('admin_login'))

    payload = _get_admin_dashboard_payload()
    return render_template(
        'admin.html',
        total_users=payload['total_users'],
        total_workouts=payload['total_workouts'],
        avg_calories=payload['avg_calories'],
        today_snapshot=payload['today_snapshot'],
        user_stats=payload['user_stats'],
        archived_users=payload['archived_users'],
    )

@app.route('/admin/data')
def admin_data():
    if session.get('role') != 'admin':
        return jsonify({'error': 'unauthorized'}), 401

    payload = _get_admin_dashboard_payload()
    user_stats = [{
        'id': item['id'],
        'username': item['username'],
        'email': item['email'],
        'active_count': item['active_count'],
        'archived_count': item['archived_count'],
        'avg_cal': item['avg_cal'],
        'avg_dur': item['avg_dur'],
        'freq_activity': item['freq_activity'],
        'avatar_url': item['avatar_url'],
    } for item in payload['user_stats']]

    archived_stats = [{
        'id': user.id,
        'username': user.username,
        'email': user.email,
        'avatar_url': user.avatar_url,
    } for user in payload['archived_users']]

    return jsonify({
        'total_users': payload['total_users'],
        'total_workouts': payload['total_workouts'],
        'avg_calories': payload['avg_calories'],
        'today_snapshot': payload['today_snapshot'],
        'user_stats': user_stats,
        'archived_users': archived_stats,
    })

@app.route('/api/public-stats')
def public_stats():
    today = date.today()
    week_start = today - timedelta(days=6)

    weekly_workouts = Workout.query.filter(
        Workout.archived == False,
        Workout.date >= week_start,
    ).count()
    total_workouts = Workout.query.count()

    calories_7d = (
        db.session.query(func.sum(Workout.calories))
        .filter(Workout.archived == False, Workout.date >= week_start)
        .scalar()
    ) or 0

    active_users = User.query.filter(User.role != 'admin', User.is_archived == False).count()
    target = max(1, active_users * 4)
    weekly_goal_pct = int(round((weekly_workouts / target) * 100))

    # Build a 7-day calories series for the homepage mini chart.
    calories_rows = (
        db.session.query(Workout.date, func.sum(Workout.calories))
        .filter(
            Workout.archived == False,
            Workout.date >= week_start,
            Workout.date <= today,
        )
        .group_by(Workout.date)
        .all()
    )
    calories_map = {row[0]: int(row[1] or 0) for row in calories_rows}
    weekly_labels = []
    weekly_calories = []
    for i in range(7):
        day = week_start + timedelta(days=i)
        weekly_labels.append(day.strftime('%a'))
        weekly_calories.append(calories_map.get(day, 0))

    return jsonify({
        'calories_7d': int(calories_7d),
        'total_workouts': total_workouts,
        'weekly_goal_pct': weekly_goal_pct,
        'weekly_labels': weekly_labels,
        'weekly_calories': weekly_calories,
    })

@app.route('/user')
def user_dashboard():
    if session.get('role') != 'user':
        flash('Please log in as a user first.', 'warning')
        return redirect(url_for('login'))

    user = db.session.get(User, session['user_id'])
    return render_template('user.html', user=user)

@app.route('/dashboard')
def dashboard():
    if session.get('role') != 'user':
        flash('Please log in as a user first.', 'warning')
        return redirect(url_for('login'))
    return redirect(url_for('user_dashboard'))

@app.route('/add-workout')
def add_workout():
    if session.get('role') != 'user':
        flash('Please log in as a user first.', 'warning')
        return redirect(url_for('login'))
    return redirect(url_for('user_dashboard'))

@app.route('/admin/user/<int:user_id>')
def admin_view_user(user_id):
    if session.get('role') != 'admin':
        flash('Admin login required.', 'warning')
        return redirect(url_for('admin_login'))
    user = db.session.get(User, user_id)
    if not user or user.role == 'admin':
        flash('User not found.', 'warning')
        return redirect(url_for('admin_dashboard'))
    log_admin_action('view_user', target_user_id=user_id)
    db.session.commit()
    return render_template('user.html', user=user, admin_view=True, view_user_id=user_id)

@app.route('/admin/api/workouts/<int:user_id>', methods=['GET'])
def admin_api_workouts(user_id):
    if session.get('role') != 'admin':
        return jsonify({'error': 'unauthorized'}), 401
    workouts = Workout.query.filter_by(user_id=user_id).order_by(Workout.date.desc()).all()
    active = []
    archived = []
    for w in workouts:
        item = {
            'id': w.id,
            'activity': w.activity,
            'duration': w.duration,
            'calories': w.calories,
            'date': w.date.isoformat(),
            'tags': [t.name for t in w.tags],
        }
        if w.archived:
            archived.append(item)
        else:
            active.append(item)
    return jsonify({'active': active, 'archived': archived})

@app.route('/admin/users/<int:user_id>/archive', methods=['POST'])
def admin_archive_user(user_id):
    if session.get('role') != 'admin':
        return jsonify({'error': 'unauthorized'}), 401
    user = db.session.get(User, user_id)
    if not user or user.role == 'admin':
        return jsonify({'error': 'not_found'}), 404
    user.is_archived = True
    log_admin_action('archive_user', target_user_id=user_id)
    db.session.commit()
    return jsonify({'ok': True})

@app.route('/admin/users/<int:user_id>/restore', methods=['POST'])
def admin_restore_user(user_id):
    if session.get('role') != 'admin':
        return jsonify({'error': 'unauthorized'}), 401
    user = db.session.get(User, user_id)
    if not user or user.role == 'admin':
        return jsonify({'error': 'not_found'}), 404
    user.is_archived = False
    log_admin_action('restore_user', target_user_id=user_id)
    db.session.commit()
    return jsonify({'ok': True})

@app.route('/admin/users/<int:user_id>/delete', methods=['POST'])
def admin_delete_user(user_id):
    if session.get('role') != 'admin':
        return jsonify({'error': 'unauthorized'}), 401
    user = db.session.get(User, user_id)
    if not user or user.role == 'admin':
        return jsonify({'error': 'not_found'}), 404
    workouts = Workout.query.filter_by(user_id=user_id).all()
    workout_ids = [w.id for w in workouts]
    if workout_ids:
        db.session.execute(workout_tag.delete().where(workout_tag.c.workout_id.in_(workout_ids)))
    Workout.query.filter_by(user_id=user_id).delete()
    DailySummary.query.filter_by(user_id=user_id).delete()
    WeeklyGoal.query.filter_by(user_id=user_id).delete()
    UserSettings.query.filter_by(user_id=user_id).delete()
    ImportExportHistory.query.filter_by(user_id=user_id).delete()
    log_admin_action('delete_user', target_user_id=user_id)
    db.session.delete(user)
    db.session.commit()
    return jsonify({'ok': True})

# -------------------- WORKOUTS API --------------------
@app.route('/api/workouts', methods=['GET'])
def api_workouts():
    if session.get('role') != 'user':
        return jsonify({'error': 'unauthorized'}), 401
    user_id = session['user_id']
    workouts = Workout.query.filter_by(user_id=user_id).order_by(Workout.date.desc()).all()
    active = []
    archived = []
    for w in workouts:
        item = {
            'id': w.id,
            'activity': w.activity,
            'duration': w.duration,
            'calories': w.calories,
            'date': w.date.isoformat(),
            'tags': [t.name for t in w.tags],
        }
        if w.archived:
            archived.append(item)
        else:
            active.append(item)
    return jsonify({'active': active, 'archived': archived})

@app.route('/api/avatar', methods=['GET'])
def get_avatar():
    if session.get('role') != 'user':
        return jsonify({'error': 'unauthorized'}), 401
    user = db.session.get(User, session['user_id'])
    return jsonify({'avatar_url': user.avatar_url if user else None})

@app.route('/api/avatar', methods=['POST'])
def set_avatar():
    if session.get('role') != 'user':
        return jsonify({'error': 'unauthorized'}), 401
    data = request.get_json(silent=True) or {}
    avatar_url = (data.get('avatar_url') or '').strip()
    if not avatar_url:
        return jsonify({'error': 'invalid'}), 400
    if not avatar_url.startswith('data:image/') or ';base64,' not in avatar_url:
        return jsonify({'error': 'invalid_format'}), 400
    # basic size guard (~2.5MB)
    if len(avatar_url) > 2_500_000:
        return jsonify({'error': 'too_large'}), 413
    user = db.session.get(User, session['user_id'])
    if not user:
        return jsonify({'error': 'not_found'}), 404
    user.avatar_url = avatar_url
    db.session.commit()
    return jsonify({'ok': True})

@app.route('/api/settings', methods=['GET', 'POST'])
def api_settings():
    if session.get('role') != 'user':
        return jsonify({'error': 'unauthorized'}), 401
    user_id = session['user_id']
    settings = UserSettings.query.filter_by(user_id=user_id).first()
    if not settings:
        user = db.session.get(User, user_id)
        settings = UserSettings(user_id=user_id, username=user.username if user else None)
        db.session.add(settings)
        db.session.commit()

    if request.method == 'POST':
        data = request.get_json(silent=True) or {}
        if 'language' in data:
            language = _clean_text(data.get('language'), 20)
            if not LANGUAGE_RE.match(language or 'en'):
                return jsonify({'error': 'invalid_language'}), 400
            settings.language = language or 'en'
        if 'units' in data:
            units = (data.get('units') or 'metric').lower()
            if units not in ('metric', 'imperial'):
                return jsonify({'error': 'invalid_units'}), 400
            settings.units = units
        if 'theme' in data:
            theme = (data.get('theme') or 'light').lower().strip()
            if theme not in ('light', 'dark', 'system'):
                return jsonify({'error': 'invalid_theme'}), 400
            settings.theme = theme
        if 'notifications' in data:
            parsed_bool = _parse_bool(data.get('notifications'))
            if parsed_bool is None:
                return jsonify({'error': 'invalid_notifications'}), 400
            settings.notifications = parsed_bool
        db.session.commit()

    return jsonify({
        'language': settings.language,
        'units': settings.units,
        'theme': settings.theme,
        'notifications': settings.notifications,
    })

@app.route('/api/weekly-goal', methods=['GET', 'POST'])
def api_weekly_goal():
    if session.get('role') != 'user':
        return jsonify({'error': 'unauthorized'}), 401
    user_id = session['user_id']
    goal = WeeklyGoal.query.filter_by(user_id=user_id).first()
    if not goal:
        user = db.session.get(User, user_id)
        goal = WeeklyGoal(user_id=user_id, username=user.username if user else None)
        db.session.add(goal)
        db.session.commit()

    if request.method == 'POST':
        data = request.get_json(silent=True) or {}
        try:
            if 'goal_workouts' in data:
                value = int(data.get('goal_workouts'))
                if value < 1 or value > 100:
                    return jsonify({'error': 'invalid_goal_workouts'}), 400
                goal.goal_workouts = value
            if 'goal_calories' in data:
                value = int(data.get('goal_calories'))
                if value < 100 or value > 50000:
                    return jsonify({'error': 'invalid_goal_calories'}), 400
                goal.goal_calories = value
            if 'goal_minutes' in data:
                value = int(data.get('goal_minutes'))
                if value < 10 or value > 10000:
                    return jsonify({'error': 'invalid_goal_minutes'}), 400
                goal.goal_minutes = value
        except (TypeError, ValueError):
            return jsonify({'error': 'invalid'}), 400
        db.session.commit()

    return jsonify({
        'goal_workouts': goal.goal_workouts,
        'goal_calories': goal.goal_calories,
        'goal_minutes': goal.goal_minutes,
    })

@app.route('/api/import-export-log', methods=['POST'])
def api_import_export_log():
    if session.get('role') != 'user':
        return jsonify({'error': 'unauthorized'}), 401
    data = request.get_json(silent=True) or {}
    action = (data.get('action') or '').lower()
    file_format = (data.get('format') or '').lower()
    try:
        records = int(data.get('records', 0))
    except (TypeError, ValueError):
        return jsonify({'error': 'invalid_records'}), 400
    if records < 0 or records > 100000:
        return jsonify({'error': 'invalid_records'}), 400
    filename = _clean_text(data.get('filename'), 200) or None
    if filename:
        filename = re.sub(r'[\r\n\t]', '_', filename)
    status = (data.get('status') or 'ok').lower()
    error_message = _clean_text(data.get('error'), 1000) or None

    if action not in ('import', 'export') or file_format not in ('csv', 'json', 'pdf'):
        return jsonify({'error': 'invalid'}), 400
    if status not in ('ok', 'failed', 'error'):
        return jsonify({'error': 'invalid_status'}), 400

    log_import_export(
        user_id=session['user_id'],
        action=action,
        file_format=file_format,
        records=records,
        filename=filename,
        status=status,
        error_message=error_message
    )
    db.session.commit()
    return jsonify({'ok': True})

@app.route('/workouts', methods=['POST'])
def create_workout():
    if session.get('role') != 'user':
        return jsonify({'error': 'unauthorized'}), 401
    data = request.get_json(silent=True) or request.form
    current_user = db.session.get(User, session['user_id'])
    activity = _clean_text(data.get('activity'), 100)
    tag_names = normalize_tags(data.get('tags') or data.get('tag'))
    try:
        duration = int(data.get('duration', 0))
        calories = int(data.get('calories', 0))
    except (TypeError, ValueError):
        return jsonify({'error': 'invalid'}), 400
    date_str = _clean_text(data.get('date'), 20)
    if not _is_valid_activity(activity) or duration <= 0 or calories <= 0 or not date_str:
        return jsonify({'error': 'invalid'}), 400
    if duration > 1440 or calories > 20000:
        return jsonify({'error': 'out_of_range'}), 400
    try:
        from datetime import date
        y, m, d = map(int, date_str.split('-'))
        workout_date = date(y, m, d)
    except Exception:
        return jsonify({'error': 'invalid_date'}), 400
    if workout_date > date.today() or workout_date < date(2000, 1, 1):
        return jsonify({'error': 'invalid_date_range'}), 400

    w = Workout(
        user_id=session['user_id'],
        username=current_user.username if current_user else None,
        activity=activity,
        duration=duration,
        calories=calories,
        date=workout_date,
        archived=False,
    )
    db.session.add(w)
    if tag_names:
        w.tags = get_or_create_tags(tag_names)
    db.session.flush()
    recalc_daily_summary(session['user_id'], workout_date)
    db.session.commit()
    return jsonify({'id': w.id})

@app.route('/workouts/<int:workout_id>/archive', methods=['POST'])
def archive_workout(workout_id):
    if session.get('role') != 'user':
        return jsonify({'error': 'unauthorized'}), 401
    w = Workout.query.filter_by(id=workout_id, user_id=session['user_id']).first()
    if not w:
        return jsonify({'error': 'not_found'}), 404
    w.archived = True
    recalc_daily_summary(w.user_id, w.date)
    db.session.commit()
    return jsonify({'ok': True})

@app.route('/workouts/<int:workout_id>/restore', methods=['POST'])
def restore_workout(workout_id):
    if session.get('role') != 'user':
        return jsonify({'error': 'unauthorized'}), 401
    w = Workout.query.filter_by(id=workout_id, user_id=session['user_id']).first()
    if not w:
        return jsonify({'error': 'not_found'}), 404
    w.archived = False
    recalc_daily_summary(w.user_id, w.date)
    db.session.commit()
    return jsonify({'ok': True})

@app.route('/workouts/<int:workout_id>/delete', methods=['POST'])
def delete_workout(workout_id):
    if session.get('role') != 'user':
        return jsonify({'error': 'unauthorized'}), 401
    w = Workout.query.filter_by(id=workout_id, user_id=session['user_id']).first()
    if not w:
        return jsonify({'error': 'not_found'}), 404
    user_id = w.user_id
    workout_date = w.date
    db.session.execute(workout_tag.delete().where(workout_tag.c.workout_id == w.id))
    db.session.delete(w)
    recalc_daily_summary(user_id, workout_date)
    db.session.commit()
    return jsonify({'ok': True})

@app.route('/workouts/restore-all', methods=['POST'])
def restore_all_workouts():
    if session.get('role') != 'user':
        return jsonify({'error': 'unauthorized'}), 401
    user_id = session['user_id']
    dates = [d for (d,) in db.session.query(Workout.date).filter_by(user_id=user_id, archived=True).distinct().all()]
    Workout.query.filter_by(user_id=user_id, archived=True).update({'archived': False})
    for d in dates:
        recalc_daily_summary(user_id, d)
    db.session.commit()
    return jsonify({'ok': True})

@app.route('/workouts/clear-archive', methods=['POST'])
def clear_archived_workouts():
    if session.get('role') != 'user':
        return jsonify({'error': 'unauthorized'}), 401
    user_id = session['user_id']
    archived = Workout.query.filter_by(user_id=user_id, archived=True).all()
    workout_ids = [w.id for w in archived]
    dates = {w.date for w in archived}
    if workout_ids:
        db.session.execute(workout_tag.delete().where(workout_tag.c.workout_id.in_(workout_ids)))
    Workout.query.filter_by(user_id=user_id, archived=True).delete()
    for d in dates:
        recalc_daily_summary(user_id, d)
    db.session.commit()
    return jsonify({'ok': True})

# -------------------- REAL-TIME (SSE) --------------------
@app.route('/events')
def events():
    if 'user_id' not in session:
        return jsonify({'error': 'unauthorized'}), 401

    role = session.get('role')
    # Admin page aggregates large datasets; slower heartbeat avoids UI lag.
    interval = 4 if role == 'admin' else 2

    def stream():
        while True:
            yield f"data: {int(time.time())}\n\n"
            time.sleep(interval)

    response = Response(stream(), mimetype='text/event-stream')
    response.headers['Cache-Control'] = 'no-cache'
    response.headers['X-Accel-Buffering'] = 'no'
    return response

# -------------------- RUN --------------------
if __name__ == '__main__':
    debug_mode = os.environ.get('FLASK_DEBUG', '0') == '1'

    # Fail fast on boot instead of returning 500 on first request.
    with app.app_context():
        db.session.execute(text('SELECT 1'))

    # Keep single-process dev server behavior to avoid duplicate listeners
    # on Windows when reloader is enabled.
    app.run(debug=debug_mode, use_reloader=False)
