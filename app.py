from flask import Flask, render_template, redirect, url_for, request, flash, session
from flask_sqlalchemy import SQLAlchemy
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

# -------------------- DATABASE INIT --------------------
@app.before_first_request
def create_tables():
    db.create_all()
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
    if 'user_id' in session:
        user = User.query.get(session['user_id'])
        if user.role == 'admin':
            return redirect(url_for('admin_dashboard'))
        return redirect(url_for('user_dashboard'))
    return redirect(url_for('login'))

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

        session['user_id'] = user.id
        session['role'] = user.role
        flash('Logged in successfully!', 'success')

        if user.role == 'admin':
            return redirect(url_for('admin_dashboard'))
        return redirect(url_for('user_dashboard'))

    return render_template('login.html')

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
    session.clear()
    flash('Logged out successfully.', 'info')
    return render_template('logout.html')

# -------- DASHBOARDS --------
@app.route('/admin')
def admin_dashboard():
    if session.get('role') != 'admin':
        flash('Access denied!', 'danger')
        return redirect(url_for('login'))

    users = User.query.filter(User.role != 'admin').all()
    return render_template('admin.html', users=users)

@app.route('/user')
def user_dashboard():
    if session.get('role') != 'user':
        flash('Access denied!', 'danger')
        return redirect(url_for('login'))

    user = User.query.get(session['user_id'])
    return render_template('user.html', user=user)

# -------------------- RUN --------------------
if __name__ == '__main__':
    app.run(debug=True)
