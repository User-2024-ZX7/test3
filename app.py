from flask import Flask, render_template, redirect, url_for, request, flash, session, jsonify
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import func, inspect, text
from werkzeug.security import generate_password_hash, check_password_hash
from config import Config

app = Flask(__name__)
app.config.from_object(Config)
db = SQLAlchemy(app)

# -------------------- MODELS --------------------
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(150), nullable=False)
    email = db.Column(db.String(150), unique=True, nullable=False)
    password = db.Column(db.String(200), nullable=False)
    role = db.Column(db.String(50), nullable=False, default='user')
    avatar_url = db.Column(db.Text, nullable=True)
    workouts = db.relationship('Workout', backref='user', lazy=True)

class Workout(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    activity = db.Column(db.String(100), nullable=False)
    duration = db.Column(db.Integer, nullable=False)
    calories = db.Column(db.Integer, nullable=False)
    date = db.Column(db.Date, nullable=False)
    archived = db.Column(db.Boolean, nullable=False, default=False)

# -------------------- DATABASE INIT --------------------
@app.before_first_request
def create_tables():
    db.create_all()
    # Ensure avatar_url column exists (lightweight migration)
    try:
        cols = [c['name'] for c in inspect(db.engine).get_columns('user')]
        if 'avatar_url' not in cols:
            db.session.execute(text('ALTER TABLE user ADD COLUMN avatar_url TEXT'))
            db.session.commit()
    except Exception:
        db.session.rollback()
    # Ensure admin exists
    admin = User.query.filter_by(email='admin@fittrack.com').first()
    if not admin:
        hashed_pw = generate_password_hash('SuperSecret123')
        admin = User(username='FitAdmin', email='admin@fittrack.com', password=hashed_pw, role='admin')
        db.session.add(admin)
        db.session.commit()

# -------------------- ROUTES --------------------
@app.route('/')
def index():
    return render_template('index.html')  # public landing page

# -------- LOGIN --------
@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        email = request.form.get('email').strip().lower()
        password = request.form.get('password')

        user = User.query.filter_by(email=email).first()
        if not user or not check_password_hash(user.password, password):
            flash('Incorrect email or password!', 'danger')
            return redirect(url_for('login'))

        if user.role == 'admin':
            flash('Admins must use the admin login page.', 'warning')
            return redirect(url_for('admin_login'))

        session['user_id'] = user.id
        session['role'] = user.role
        flash('Logged in successfully!', 'success')

        return redirect(url_for('user_dashboard'))

    return render_template('login.html')

# -------- ADMIN LOGIN --------
@app.route('/admin-login', methods=['GET', 'POST'])
def admin_login():
    if session.get('role') == 'admin':
        return redirect(url_for('admin_dashboard'))
    if request.method == 'POST':
        email = request.form.get('email').strip().lower()
        admin_name = (request.form.get('admin_name') or '').strip()
        password = request.form.get('password')

        if email != 'admin@fittrack.com':
            flash('Incorrect admin email or password!', 'danger')
            return redirect(url_for('admin_login'))
        if admin_name and admin_name != 'FitAdmin':
            flash('Incorrect admin email or password!', 'danger')
            return redirect(url_for('admin_login'))

        user = User.query.filter_by(email='admin@fittrack.com', role='admin').first()
        if not user or not check_password_hash(user.password, password):
            flash('Incorrect admin email or password!', 'danger')
            return redirect(url_for('admin_login'))

        session['user_id'] = user.id
        session['role'] = user.role
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

# -------- REGISTER --------
@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        username = request.form.get('username').strip()
        email = request.form.get('email').strip().lower()
        password = request.form.get('password')
        confirm_password = request.form.get('confirm_password')

        if password != confirm_password:
            flash('Passwords do not match!', 'danger')
            return redirect(url_for('register'))

        if email == 'admin@fittrack.com':
            flash('This email is reserved for admins.', 'warning')
            return redirect(url_for('register'))

        if User.query.filter_by(email=email).first():
            flash('Email already registered!', 'warning')
            return redirect(url_for('register'))

        hashed_pw = generate_password_hash(password)
        user = User(username=username, email=email, password=hashed_pw, role='user')
        db.session.add(user)
        db.session.commit()

        flash('Registration successful! Please log in.', 'success')
        return redirect(url_for('login'))

    return render_template('register.html')

# -------- LOGOUT --------
@app.route('/logout')
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
        flash('Access denied!', 'danger')
        return redirect(url_for('login'))

    users = User.query.filter(User.role != 'admin').all()
    total_users = len(users)
    total_workouts = Workout.query.count()
    avg_calories = db.session.query(func.avg(Workout.calories)).scalar() or 0

    user_stats = []
    for u in users:
        active_count = Workout.query.filter_by(user_id=u.id, archived=False).count()
        archived_count = Workout.query.filter_by(user_id=u.id, archived=True).count()
        avg_cal = db.session.query(func.avg(Workout.calories)).filter_by(user_id=u.id).scalar() or 0
        avg_dur = db.session.query(func.avg(Workout.duration)).filter_by(user_id=u.id).scalar() or 0
        freq = (
            db.session.query(Workout.activity, func.count(Workout.id))
            .filter_by(user_id=u.id)
            .group_by(Workout.activity)
            .order_by(func.count(Workout.id).desc())
            .first()
        )
        freq_activity = freq[0] if freq else '-'
        user_stats.append({
            'user': u,
            'active_count': active_count,
            'archived_count': archived_count,
            'avg_cal': int(round(avg_cal)) if avg_cal else 0,
            'avg_dur': int(round(avg_dur)) if avg_dur else 0,
            'freq_activity': freq_activity,
            'avatar_url': u.avatar_url,
        })

    return render_template(
        'admin.html',
        total_users=total_users,
        total_workouts=total_workouts,
        avg_calories=int(round(avg_calories)) if avg_calories else 0,
        user_stats=user_stats,
    )

@app.route('/user')
def user_dashboard():
    if session.get('role') != 'user':
        flash('Access denied!', 'danger')
        return redirect(url_for('login'))

    user = db.session.get(User, session['user_id'])
    return render_template('user.html', user=user)

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
    user = db.session.get(User, session['user_id'])
    if not user:
        return jsonify({'error': 'not_found'}), 404
    user.avatar_url = avatar_url
    db.session.commit()
    return jsonify({'ok': True})

@app.route('/workouts', methods=['POST'])
def create_workout():
    if session.get('role') != 'user':
        return jsonify({'error': 'unauthorized'}), 401
    data = request.get_json(silent=True) or request.form
    activity = (data.get('activity') or '').strip()
    try:
        duration = int(data.get('duration', 0))
        calories = int(data.get('calories', 0))
    except (TypeError, ValueError):
        return jsonify({'error': 'invalid'}), 400
    date_str = (data.get('date') or '').strip()
    if not activity or duration <= 0 or calories <= 0 or not date_str:
        return jsonify({'error': 'invalid'}), 400
    try:
        from datetime import date
        y, m, d = map(int, date_str.split('-'))
        workout_date = date(y, m, d)
    except Exception:
        return jsonify({'error': 'invalid_date'}), 400

    w = Workout(
        user_id=session['user_id'],
        activity=activity,
        duration=duration,
        calories=calories,
        date=workout_date,
        archived=False,
    )
    db.session.add(w)
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
    db.session.commit()
    return jsonify({'ok': True})

@app.route('/workouts/<int:workout_id>/delete', methods=['POST'])
def delete_workout(workout_id):
    if session.get('role') != 'user':
        return jsonify({'error': 'unauthorized'}), 401
    w = Workout.query.filter_by(id=workout_id, user_id=session['user_id']).first()
    if not w:
        return jsonify({'error': 'not_found'}), 404
    db.session.delete(w)
    db.session.commit()
    return jsonify({'ok': True})

@app.route('/workouts/restore-all', methods=['POST'])
def restore_all_workouts():
    if session.get('role') != 'user':
        return jsonify({'error': 'unauthorized'}), 401
    user_id = session['user_id']
    Workout.query.filter_by(user_id=user_id, archived=True).update({'archived': False})
    db.session.commit()
    return jsonify({'ok': True})

@app.route('/workouts/clear-archive', methods=['POST'])
def clear_archived_workouts():
    if session.get('role') != 'user':
        return jsonify({'error': 'unauthorized'}), 401
    user_id = session['user_id']
    Workout.query.filter_by(user_id=user_id, archived=True).delete()
    db.session.commit()
    return jsonify({'ok': True})

# -------------------- RUN --------------------
if __name__ == '__main__':
    app.run(debug=True)
