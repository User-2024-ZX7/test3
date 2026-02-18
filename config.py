import os
from pathlib import Path
from datetime import timedelta


def _env_stripped(name):
    value = os.environ.get(name)
    if value is None:
        return None
    value = value.strip()
    return value or None


def _is_development_mode():
    env = (os.environ.get('FLASK_ENV') or 'development').lower()
    debug = os.environ.get('FLASK_DEBUG', '0') == '1'
    return env == 'development' or debug


class Config:
    IS_DEV = _is_development_mode()
    BASE_DIR = Path(__file__).resolve().parent
    INSTANCE_DIR = BASE_DIR / 'instance'

    # Secret key for sessions and CSRF protection
    SECRET_KEY = os.environ.get('SECRET_KEY')
    if not SECRET_KEY:
        if IS_DEV:
            SECRET_KEY = os.urandom(32).hex()
        else:
            raise RuntimeError('SECRET_KEY must be set outside development.')

    # SQLAlchemy database URI
    # Preferred: DATABASE_URL
    DATABASE_URL = _env_stripped('DATABASE_URL')
    DB_USER = _env_stripped('DB_USER') or ('root' if IS_DEV else None)
    DB_PASSWORD = _env_stripped('DB_PASSWORD') or ('root' if IS_DEV else None)
    DB_HOST = _env_stripped('DB_HOST') or 'localhost'
    DB_PORT = _env_stripped('DB_PORT') or '3306'
    DB_NAME = _env_stripped('DB_NAME') or 'fittrack'

    if DATABASE_URL:
        SQLALCHEMY_DATABASE_URI = DATABASE_URL
    elif all([DB_USER, DB_PASSWORD]):
        SQLALCHEMY_DATABASE_URI = (
            f'mysql+pymysql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}'
        )
    else:
        raise RuntimeError(
            'MySQL configuration is required. Set DATABASE_URL (mysql+pymysql://...) '
            'or set DB_USER/DB_PASSWORD (DB_HOST/DB_PORT/DB_NAME default to localhost/3306/fittrack). '
            'In development, DB_USER/DB_PASSWORD fall back to root/root.'
        )

    if not str(SQLALCHEMY_DATABASE_URI).startswith('mysql+pymysql://'):
        raise RuntimeError(
            'Only MySQL is allowed for this project. '
            'Use mysql+pymysql://... and do not use SQLite.'
        )

    # Disable track modifications (saves resources)
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {
        'pool_pre_ping': True,
        'pool_recycle': 280,
    }

    # Session hardening
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = 'Lax'
    SESSION_COOKIE_SECURE = os.environ.get('SESSION_COOKIE_SECURE', '1' if not IS_DEV else '0') == '1'
    PERMANENT_SESSION_LIFETIME = timedelta(hours=8)



