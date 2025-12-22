import os

class Config:
    # Secret key for sessions and CSRF protection
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'supersecretkey'

    # SQLAlchemy database URI for MySQL
    # Format: mysql+pymysql://<username>:<password>@<host>/<database>
    SQLALCHEMY_DATABASE_URI = 'mysql+pymysql://root:root@localhost/fittrack'

    # Disable track modifications (saves resources)
    SQLALCHEMY_TRACK_MODIFICATIONS = False



