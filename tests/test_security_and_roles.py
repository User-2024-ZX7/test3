import os
import unittest
from datetime import date, timedelta

import werkzeug
from werkzeug.security import check_password_hash, generate_password_hash

TEST_DATABASE_URL = os.environ.get('TEST_DATABASE_URL')
if not TEST_DATABASE_URL:
    raise RuntimeError(
        'TEST_DATABASE_URL is required for tests and must point to a dedicated MySQL test database '
        '(mysql+pymysql://user:pass@host:3306/fittrack_test).'
    )
if not TEST_DATABASE_URL.startswith('mysql+pymysql://'):
    raise RuntimeError('TEST_DATABASE_URL must use mysql+pymysql://')

os.environ['DATABASE_URL'] = TEST_DATABASE_URL
os.environ.setdefault('FLASK_DEBUG', '0')
os.environ.setdefault('SESSION_COOKIE_SECURE', '0')
os.environ.setdefault('SECRET_KEY', 'test-secret-key')

import app as app_module  # noqa: E402

if not hasattr(werkzeug, '__version__'):
    werkzeug.__version__ = '3.x'


class SecurityRoleTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app = app_module.app
        cls.db = app_module.db
        cls.User = app_module.User
        cls.Workout = app_module.Workout
        cls.app.config.update(TESTING=True)

    def setUp(self):
        with self.app.app_context():
            self.db.drop_all()
            self.db.create_all()
            admin = self.User(
                username='FitAdmin',
                email='admin@fittrack.com',
                password=generate_password_hash('SuperSecret123'),
                role='admin',
            )
            user = self.User(
                username='StudentUser',
                email='student@example.com',
                password=generate_password_hash('StrongPass123'),
                role='user',
            )
            self.db.session.add(admin)
            self.db.session.add(user)
            self.db.session.commit()
            self.admin_id = admin.id
            self.user_id = user.id
        self.client = self.app.test_client()

    def _csrf_from(self, route):
        self.client.get(route)
        with self.client.session_transaction() as sess:
            return sess.get('csrf_token')

    def _session_csrf(self):
        with self.client.session_transaction() as sess:
            return sess.get('csrf_token')

    def _login_user(self, email='student@example.com', password='StrongPass123'):
        token = self._csrf_from('/login')
        return self.client.post(
            '/login',
            data={'csrf_token': token, 'email': email, 'password': password},
            follow_redirects=False,
        )

    def _login_admin(self):
        token = self._csrf_from('/admin-login')
        return self.client.post(
            '/admin-login',
            data={
                'csrf_token': token,
                'email': 'admin@fittrack.com',
                'admin_name': 'FitAdmin',
                'password': 'SuperSecret123',
            },
            follow_redirects=False,
        )

    def _post_json(self, url, payload):
        return self.client.post(
            url,
            json=payload,
            headers={'Accept': 'application/json', 'X-CSRFToken': self._session_csrf() or ''},
        )

    def _post_with_csrf(self, url):
        return self.client.post(
            url,
            headers={'Accept': 'application/json', 'X-CSRFToken': self._session_csrf() or ''},
        )

    def test_login_rejects_missing_csrf(self):
        res = self.client.post('/login', data={'email': 'student@example.com', 'password': 'StrongPass123'})
        self.assertEqual(res.status_code, 302)

    def test_register_hashes_password(self):
        token = self._csrf_from('/register')
        res = self.client.post(
            '/register',
            data={
                'csrf_token': token,
                'username': 'NewUser',
                'email': 'new@example.com',
                'password': 'StrongPass123',
                'confirm_password': 'StrongPass123',
            },
            follow_redirects=True,
        )
        self.assertEqual(res.status_code, 200)
        with self.app.app_context():
            user = self.User.query.filter_by(email='new@example.com').first()
            self.assertIsNotNone(user)
            self.assertNotEqual(user.password, 'StrongPass123')
            self.assertTrue(check_password_hash(user.password, 'StrongPass123'))

    def test_register_rejects_reserved_admin_email(self):
        token = self._csrf_from('/register')
        res = self.client.post(
            '/register',
            data={
                'csrf_token': token,
                'username': 'SpoofAdmin',
                'email': 'admin@fittrack.com',
                'password': 'StrongPass123',
                'confirm_password': 'StrongPass123',
            },
            follow_redirects=False,
        )
        self.assertEqual(res.status_code, 302)
        with self.app.app_context():
            users = self.User.query.filter_by(email='admin@fittrack.com').all()
            self.assertEqual(len(users), 1)

    def test_user_cannot_access_admin_dashboard(self):
        self._login_user()
        res = self.client.get('/admin', follow_redirects=False)
        self.assertEqual(res.status_code, 302)
        self.assertIn('/admin-login', res.headers.get('Location', ''))

    def test_admin_can_access_admin_dashboard(self):
        self._login_admin()
        res = self.client.get('/admin')
        self.assertEqual(res.status_code, 200)

    def test_api_workouts_requires_user_role(self):
        res = self.client.get('/api/workouts')
        self.assertEqual(res.status_code, 401)

    def test_logout_get_is_not_allowed(self):
        res = self.client.get('/logout')
        self.assertEqual(res.status_code, 405)

    def test_logout_post_clears_session(self):
        self._login_user()
        res = self.client.post('/logout', data={'csrf_token': self._session_csrf()}, follow_redirects=False)
        self.assertEqual(res.status_code, 302)
        self.assertIn('/login', res.headers.get('Location', ''))
        with self.client.session_transaction() as sess:
            self.assertNotIn('user_id', sess)
            self.assertNotIn('role', sess)

    def test_archived_user_cannot_login(self):
        with self.app.app_context():
            user = self.db.session.get(self.User, self.user_id)
            user.is_archived = True
            self.db.session.commit()
        res = self._login_user()
        self.assertEqual(res.status_code, 302)
        self.assertIn('/login', res.headers.get('Location', ''))
        with self.client.session_transaction() as sess:
            self.assertNotIn('user_id', sess)

    def test_user_cannot_archive_users_via_admin_api(self):
        self._login_user()
        res = self._post_with_csrf(f'/admin/users/{self.user_id}/archive')
        self.assertEqual(res.status_code, 401)

    def test_admin_can_archive_and_restore_user(self):
        self._login_admin()
        archive_res = self._post_with_csrf(f'/admin/users/{self.user_id}/archive')
        self.assertEqual(archive_res.status_code, 200)
        with self.app.app_context():
            user = self.db.session.get(self.User, self.user_id)
            self.assertTrue(user.is_archived)

        restore_res = self._post_with_csrf(f'/admin/users/{self.user_id}/restore')
        self.assertEqual(restore_res.status_code, 200)
        with self.app.app_context():
            user = self.db.session.get(self.User, self.user_id)
            self.assertFalse(user.is_archived)

    def test_admin_delete_removes_user_and_workouts(self):
        with self.app.app_context():
            self.db.session.add(self.Workout(
                user_id=self.user_id,
                username='StudentUser',
                activity='running',
                duration=30,
                calories=300,
                date=date.today(),
                archived=False,
            ))
            self.db.session.commit()
        self._login_admin()
        res = self._post_with_csrf(f'/admin/users/{self.user_id}/delete')
        self.assertEqual(res.status_code, 200)
        with self.app.app_context():
            self.assertIsNone(self.db.session.get(self.User, self.user_id))
            self.assertEqual(self.Workout.query.filter_by(user_id=self.user_id).count(), 0)

    def test_admin_data_requires_admin_role(self):
        self._login_user()
        res = self.client.get('/admin/data')
        self.assertEqual(res.status_code, 401)

    def test_workout_create_rejects_future_date(self):
        self._login_user()
        payload = {
            'activity': 'run',
            'duration': 30,
            'calories': 250,
            'date': (date.today() + timedelta(days=1)).isoformat(),
        }
        res = self._post_json('/workouts', payload)
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.get_json().get('error'), 'invalid_date_range')

    def test_workout_archive_restore_flow(self):
        self._login_user()
        create_res = self._post_json('/workouts', {
            'activity': 'cycling',
            'duration': 45,
            'calories': 420,
            'date': date.today().isoformat(),
        })
        self.assertEqual(create_res.status_code, 200)
        workout_id = create_res.get_json().get('id')
        self.assertTrue(workout_id)

        archive_res = self._post_with_csrf(f'/workouts/{workout_id}/archive')
        self.assertEqual(archive_res.status_code, 200)
        data_after_archive = self.client.get('/api/workouts').get_json()
        self.assertEqual(len(data_after_archive.get('active', [])), 0)
        self.assertEqual(len(data_after_archive.get('archived', [])), 1)

        restore_res = self._post_with_csrf(f'/workouts/{workout_id}/restore')
        self.assertEqual(restore_res.status_code, 200)
        data_after_restore = self.client.get('/api/workouts').get_json()
        self.assertEqual(len(data_after_restore.get('active', [])), 1)
        self.assertEqual(len(data_after_restore.get('archived', [])), 0)

    def test_avatar_api_rejects_invalid_format(self):
        self._login_user()
        res = self._post_json('/api/avatar', {'avatar_url': 'https://example.com/a.jpg'})
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.get_json().get('error'), 'invalid_format')

    def test_settings_api_rejects_invalid_units(self):
        self._login_user()
        res = self._post_json('/api/settings', {'units': 'stone'})
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.get_json().get('error'), 'invalid_units')

    def test_import_export_log_rejects_invalid_format(self):
        self._login_user()
        res = self._post_json('/api/import-export-log', {
            'action': 'export',
            'format': 'xml',
            'records': 3,
            'filename': 'bad.xml',
        })
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.get_json().get('error'), 'invalid')

    def test_admin_login_rejects_wrong_admin_name(self):
        token = self._csrf_from('/admin-login')
        res = self.client.post(
            '/admin-login',
            data={
                'csrf_token': token,
                'email': 'admin@fittrack.com',
                'admin_name': 'NotFitAdmin',
                'password': 'SuperSecret123',
            },
            follow_redirects=False,
        )
        self.assertEqual(res.status_code, 302)
        self.assertIn('/admin-login', res.headers.get('Location', ''))


if __name__ == '__main__':
    unittest.main(verbosity=2)
