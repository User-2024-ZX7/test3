'''
from flask import Flask, render_template, jsonify, request
from flask_cors import CORS
from datetime import datetime
import json

app = Flask(__name__)
CORS(app)

# In-memory demo storage (replace with DB later)
ACTIVE_WORKOUTS = []
ARCHIVED_WORKOUTS = []

# Helper to validate workout data
def normalize_workout(w):
    return {
        "id": w.get("id") or str(datetime.now().timestamp()),
        "activity": w.get("activity","").strip(),
        "duration": max(0,int(w.get("duration",0))),
        "calories": max(0,int(w.get("calories",0))),
        "date": w.get("date") or datetime.now().strftime("%Y-%m-%d")
    }

@app.route("/")
def index():
    return render_template("live_demo.html")

@app.route("/api/workouts/active", methods=["GET","POST"])
def active_workouts():
    global ACTIVE_WORKOUTS
    if request.method == "GET":
        return jsonify(ACTIVE_WORKOUTS)
    data = request.json
    workout = normalize_workout(data)
    ACTIVE_WORKOUTS.append(workout)
    return jsonify(workout)

@app.route("/api/workouts/active/<wid>", methods=["DELETE"])
def delete_active(wid):
    global ACTIVE_WORKOUTS
    ACTIVE_WORKOUTS = [w for w in ACTIVE_WORKOUTS if w["id"] != wid]
    return jsonify({"status":"deleted"})

@app.route("/api/workouts/archive/<wid>", methods=["POST"])
def archive_active(wid):
    global ACTIVE_WORKOUTS, ARCHIVED_WORKOUTS
    workout = next((w for w in ACTIVE_WORKOUTS if w["id"]==wid), None)
    if workout:
        ACTIVE_WORKOUTS = [w for w in ACTIVE_WORKOUTS if w["id"] != wid]
        ARCHIVED_WORKOUTS.append(workout)
        return jsonify({"status":"archived"})
    return jsonify({"error":"not found"}),404

@app.route("/api/workouts/archived", methods=["GET"])
def archived_workouts():
    return jsonify(ARCHIVED_WORKOUTS)

@app.route("/api/workouts/archive/<wid>/restore", methods=["POST"])
def restore_archived(wid):
    global ACTIVE_WORKOUTS, ARCHIVED_WORKOUTS
    workout = next((w for w in ARCHIVED_WORKOUTS if w["id"]==wid), None)
    if workout:
        ARCHIVED_WORKOUTS = [w for w in ARCHIVED_WORKOUTS if w["id"] != wid]
        ACTIVE_WORKOUTS.append(workout)
        return jsonify({"status":"restored"})
    return jsonify({"error":"not found"}),404

@app.route("/api/export/json")
def export_json():
    payload = {"active": ACTIVE_WORKOUTS, "archived": ARCHIVED_WORKOUTS}
    return app.response_class(
        json.dumps(payload, indent=2),
        mimetype="application/json",
        headers={"Content-Disposition":"attachment;filename=fittrack_export.json"}
    )

if __name__ == "__main__":
    app.run(debug=True)
'''

'''
from flask import Flask, jsonify
import mysql.connector

app=Flask(__name__)

con=mysql.connector.connect(
    host='localhost',
    user='root',
    password='root',
    database='my_db'
)

@app.route('/getTable',methods=['GET'])
def get_tables():
    cursor=con.cursor()
    cursor.execute("SHOW TABLES;")
    tables=cursor.fetchall()
    cursor.close()
    con.close()
    print(tables)
    table_names=[table[0] for table in tables]
    return jsonify({"tables":table_names}), 200
    
if __name__ == "__main__":
    print("connected to db successfully")
    app.run(debug=True)
'''

from flask import Flask, render_template, request, redirect, session, url_for
import pymysql
from werkzeug.security import generate_password_hash, check_password_hash

app = Flask(__name__)
app.secret_key = "supersecretkey123"   # Change this!

# ------------------ DATABASE CONNECTION ------------------
con = pymysql.connect(
    host="localhost",
    user="root",
    password="root",
    database="my_db",
    cursorclass=pymysql.cursors.DictCursor
)
cursor = con.cursor()

# =========================================================
# ------------------------ ROUTES -------------------------
# =========================================================

# ---------------- HOME PAGE ----------------
@app.route("/")
def index():
    return render_template("index.html")


# ---------------- REGISTER ----------------
@app.route("/register", methods=["GET", "POST"])
def register():

    if request.method == "POST":
        name = request.form["name"]
        email = request.form["email"]
        password = generate_password_hash(request.form["password"])
        role = "user"

        query = "INSERT INTO users (name, email, password, role) VALUES (%s, %s, %s, %s)"
        cursor.execute(query, (name, email, password, role))
        con.commit()

        return redirect("/login")

    return render_template("register.html")


# ---------------- LOGIN ----------------
@app.route("/login", methods=["GET", "POST"])
def login():

    if request.method == "POST":
        email = request.form["email"]
        password = request.form["password"]

        query = "SELECT * FROM users WHERE email = %s"
        cursor.execute(query, (email,))
        user = cursor.fetchone()

        if user and check_password_hash(user["password"], password):
            session["user_id"] = user["id"]
            session["role"] = user["role"]
            session["name"] = user["name"]

            # Redirect based on role
            if user["role"] == "admin":
                return redirect("/admin")
            else:
                return redirect("/user")

        return render_template("login.html", error="Invalid email or password.")

    return render_template("login.html")


# ---------------- LOGOUT ----------------
@app.route("/logout")
def logout():
    session.clear()
    return redirect("/")


# ---------------- USER DASHBOARD ----------------
@app.route("/user")
def user_dashboard():
    if "user_id" not in session:
        return redirect("/login")

    return render_template("user.html", name=session["name"])


# ---------------- ADMIN DASHBOARD ----------------
@app.route("/admin")
def admin_dashboard():

    if "user_id" not in session:
        return redirect("/login")

    if session["role"] != "admin":
        return "<h2>Access Denied: Admins Only</h2>"

    # Fetch all users
    cursor.execute("SELECT id, name, email, role FROM users")
    users = cursor.fetchall()

    return render_template("admin.html", users=users)


# =========================================================
# ------------------------ RUN APP ------------------------
# =========================================================

if __name__ == "__main__":
    app.run(debug=True)
