from flask import Flask
from flask_mysqldb import MySQL

app = Flask(__name__)
app.config['MYSQL_HOST'] = 'localhost'
app.config['MYSQL_USER'] = 'root'
app.config['MYSQL_PASSWORD'] = 'your_mysql_password'
app.config['MYSQL_DB'] = 'fittrack'

mysql = MySQL(app)

try:
    cursor = mysql.connection.cursor()
    cursor.execute("SELECT 1")
    print("Connection OK!")
except Exception as e:
    print("Error:", e)
