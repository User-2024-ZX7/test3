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
