from flask import Flask
from flask_mysqldb import MySQL
import os


def _require_env(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


app = Flask(__name__)
app.config['MYSQL_HOST'] = os.environ.get('DB_HOST', 'localhost')
app.config['MYSQL_PORT'] = int(os.environ.get('DB_PORT', '3306'))
app.config['MYSQL_USER'] = _require_env('DB_USER')
app.config['MYSQL_PASSWORD'] = _require_env('DB_PASSWORD')
app.config['MYSQL_DB'] = _require_env('DB_NAME')

mysql = MySQL(app)

try:
    cursor = mysql.connection.cursor()
    cursor.execute('SELECT 1')
    print('Connection OK!')
except Exception as e:
    print('Error:', e)