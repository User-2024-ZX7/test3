# Deploy FitTrack on PythonAnywhere

This gives you a public URL instead of `http://127.0.0.1:5000`.

## Important MySQL note (PythonAnywhere policy)
- PythonAnywhere states MySQL works on:
  - paid accounts, or
  - free accounts created before **January 15, 2026** (EU: before **January 8, 2026**).
- If your account is newer, use a paid plan for MySQL (recommended for this project).

## 1. Create account and app
1. Sign in to PythonAnywhere.
2. Go to `Web` -> `Add a new web app`.
3. Choose:
   - `Manual configuration`
   - Python `3.11`

## 2. Upload project
In PythonAnywhere `Bash`:

```bash
cd ~
git clone https://github.com/<your-username>/<your-repo>.git
cd <your-repo>
python3.11 -m venv venv
source venv/bin/activate

```

## 3. Set environment variables
In PythonAnywhere `Bash` (replace values):

```bash
echo 'export SECRET_KEY="your-long-random-secret"' >> ~/.bashrc
echo 'export FLASK_DEBUG=0' >> ~/.bashrc
echo 'export SESSION_COOKIE_SECURE=1' >> ~/.bashrc
echo 'export DATABASE_URL="mysql+pymysql://<db_user>:<db_password>@<db_host>/<db_name>"' >> ~/.bashrc
source ~/.bashrc
```

## 4. Configure WSGI file
Open the WSGI config file from the `Web` tab and set:

```python
import sys
path = '/home/<your-pythonanywhere-username>/<your-repo>'
if path not in sys.path:
    sys.path.append(path)

from app import app as application
```

## 5. Static files mapping
In `Web` tab -> `Static files`:
- URL: `/static/`
- Directory: `/home/<your-pythonanywhere-username>/<your-repo>/static/`

## 6. Run migrations
In `Bash`:

```bash
cd ~/<your-repo>
source venv/bin/activate
python -m flask --app app db upgrade
```

## 7. Reload and test
1. Click `Reload` in PythonAnywhere `Web` tab.
2. Open your public URL:
   - `https://<your-pythonanywhere-username>.pythonanywhere.com`
3. Test:
   - `/`
   - `/login`
   - `/admin-login`
   - workout create/archive/restore

## Troubleshooting
- `500 error`: check `Web` -> `Error log`.
- DB connection error: verify `DATABASE_URL` is correct and DB is reachable.
- Missing CSS/images: verify static mapping path.
