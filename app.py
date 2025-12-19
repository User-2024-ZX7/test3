from flask import Flask, request, jsonify
from flask_login import LoginManager, login_required, current_user, logout_user
from werkzeug.utils import secure_filename
import mysql.connector, os

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = 'dashboard/images/avatars'
login_manager = LoginManager(app)

def get_db():
    return mysql.connector.connect(
        host="localhost", user="your_user", password="your_pass", database="fittrack"
    )

# ------------------- WORKOUTS -------------------
@app.route('/api/workouts', methods=['GET'])
@login_required
def get_workouts():
    db = get_db()
    cursor = db.cursor(dictionary=True)
    cursor.execute("SELECT * FROM workouts WHERE user_id=%s ORDER BY date DESC", (current_user.id,))
    data = cursor.fetchall()
    cursor.close(); db.close()
    return jsonify(data)

@app.route('/api/workouts', methods=['POST'])
@login_required
def add_workout():
    p = request.json
    db = get_db(); cursor = db.cursor()
    cursor.execute("INSERT INTO workouts (user_id, activity, duration, calories, date) VALUES (%s,%s,%s,%s,%s)",
                   (current_user.id, p['activity'], p['duration'], p['calories'], p['date']))
    db.commit(); cursor.close(); db.close()
    return jsonify({"status":"success"})

@app.route('/api/workouts/<int:w_id>', methods=['DELETE'])
@login_required
def delete_workout(w_id):
    db = get_db(); cursor = db.cursor()
    cursor.execute("DELETE FROM workouts WHERE id=%s AND user_id=%s", (w_id, current_user.id))
    db.commit(); cursor.close(); db.close()
    return jsonify({"status":"deleted"})

@app.route('/api/workouts/<int:w_id>/archive', methods=['POST'])
@login_required
def archive_workout(w_id):
    db = get_db(); cursor = db.cursor()
    cursor.execute("INSERT INTO archived_workouts (user_id, activity, duration, calories, date) SELECT user_id, activity, duration, calories, date FROM workouts WHERE id=%s AND user_id=%s", (w_id, current_user.id))
    cursor.execute("DELETE FROM workouts WHERE id=%s AND user_id=%s", (w_id, current_user.id))
    db.commit(); cursor.close(); db.close()
    return jsonify({"status":"archived"})

# ------------------- ARCHIVED -------------------
@app.route('/api/archived_workouts', methods=['GET'])
@login_required
def get_archived():
    db = get_db(); cursor = db.cursor(dictionary=True)
    cursor.execute("SELECT * FROM archived_workouts WHERE user_id=%s ORDER BY date DESC", (current_user.id,))
    data = cursor.fetchall()
    cursor.close(); db.close()
    return jsonify(data)

@app.route('/api/archived_workouts/<int:w_id>/restore', methods=['POST'])
@login_required
def restore_archived(w_id):
    db = get_db(); cursor = db.cursor()
    cursor.execute("INSERT INTO workouts (user_id, activity, duration, calories, date) SELECT user_id, activity, duration, calories, date FROM archived_workouts WHERE id=%s AND user_id=%s", (w_id, current_user.id))
    cursor.execute("DELETE FROM archived_workouts WHERE id=%s AND user_id=%s", (w_id, current_user.id))
    db.commit(); cursor.close(); db.close()
    return jsonify({"status":"restored"})

@app.route('/api/archived_workouts/<int:w_id>', methods=['DELETE'])
@login_required
def delete_archived(w_id):
    db = get_db(); cursor = db.cursor()
    cursor.execute("DELETE FROM archived_workouts WHERE id=%s AND user_id=%s", (w_id, current_user.id))
    db.commit(); cursor.close(); db.close()
    return jsonify({"status":"deleted"})

@app.route('/api/archived_workouts/clear', methods=['POST'])
@login_required
def clear_archived():
    db = get_db(); cursor = db.cursor()
    cursor.execute("DELETE FROM archived_workouts WHERE user_id=%s", (current_user.id,))
    db.commit(); cursor.close(); db.close()
    return jsonify({"status":"cleared"})

@app.route('/api/archived_workouts/restore_all', methods=['POST'])
@login_required
def restore_all():
    db = get_db(); cursor = db.cursor()
    cursor.execute("INSERT INTO workouts (user_id, activity, duration, calories, date) SELECT user_id, activity, duration, calories, date FROM archived_workouts WHERE user_id=%s", (current_user.id,))
    cursor.execute("DELETE FROM archived_workouts WHERE user_id=%s", (current_user.id,))
    db.commit(); cursor.close(); db.close()
    return jsonify({"status":"restored_all"})

# ------------------- AVATAR -------------------
@app.route('/api/avatar', methods=['POST'])
@login_required
def upload_avatar():
    if 'avatar' not in request.files:
        return jsonify({"error":"No file"}), 400
    file = request.files['avatar']
    filename = secure_filename(f"user_{current_user.id}_{file.filename}")
    filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    file.save(filepath)
    db = get_db(); cursor = db.cursor()
    cursor.execute("UPDATE users SET avatar=%s WHERE id=%s", (filename, current_user.id))
    db.commit(); cursor.close(); db.close()
    return jsonify({"status":"uploaded","url":f"/dashboard/images/avatars/{filename}"})

# ------------------- LOGOUT -------------------
@app.route('/logout', methods=['POST'])
@login_required
def logout():
    logout_user()
    return jsonify({"status":"logged_out"})
''''''