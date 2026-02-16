import os
import unittest
from datetime import date

import werkzeug
from werkzeug.security import generate_password_hash

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


class IntegrationFlowTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app = app_module.app
        cls.db = app_module.db
        cls.User = app_module.User
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
                username='FlowUser',
                email='flow@example.com',
                password=generate_password_hash('StrongPass123'),
                role='user',
            )
            self.db.session.add(admin)
            self.db.session.add(user)
            self.db.session.commit()
            self.user_id = user.id
        self.client = self.app.test_client()

    def _csrf_from(self, route):
        self.client.get(route)
        with self.client.session_transaction() as sess:
            return sess.get('csrf_token')

    def _session_csrf(self):
        with self.client.session_transaction() as sess:
            return sess.get('csrf_token')

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

    def test_user_workout_then_admin_archive_integration_flow(self):
        # 1) User login
        user_csrf = self._csrf_from('/login')
        login_res = self.client.post(
            '/login',
            data={'csrf_token': user_csrf, 'email': 'flow@example.com', 'password': 'StrongPass123'},
            follow_redirects=False,
        )
        self.assertEqual(login_res.status_code, 302)
        self.assertIn('/user', login_res.headers.get('Location', ''))

        # 2) User adds workout
        add_res = self._post_json('/workouts', {
            'activity': 'running',
            'duration': 35,
            'calories': 360,
            'date': date.today().isoformat(),
        })
        self.assertEqual(add_res.status_code, 200)

        workouts_res = self.client.get('/api/workouts')
        self.assertEqual(workouts_res.status_code, 200)
        workouts_payload = workouts_res.get_json()
        self.assertEqual(len(workouts_payload.get('active', [])), 1)

        # 3) User logout
        logout_res = self.client.post('/logout', data={'csrf_token': self._session_csrf()}, follow_redirects=False)
        self.assertEqual(logout_res.status_code, 302)
        self.assertIn('/login', logout_res.headers.get('Location', ''))

        # 4) Admin login
        admin_csrf = self._csrf_from('/admin-login')
        admin_login_res = self.client.post(
            '/admin-login',
            data={
                'csrf_token': admin_csrf,
                'email': 'admin@fittrack.com',
                'admin_name': 'FitAdmin',
                'password': 'SuperSecret123',
            },
            follow_redirects=False,
        )
        self.assertEqual(admin_login_res.status_code, 302)
        self.assertIn('/admin', admin_login_res.headers.get('Location', ''))

        # 5) Admin archives user
        archive_res = self._post_with_csrf(f'/admin/users/{self.user_id}/archive')
        self.assertEqual(archive_res.status_code, 200)

        dashboard_data_res = self.client.get('/admin/data')
        self.assertEqual(dashboard_data_res.status_code, 200)
        archived_user_ids = {item['id'] for item in dashboard_data_res.get_json().get('archived_users', [])}
        self.assertIn(self.user_id, archived_user_ids)

        # 6) User cannot login once archived
        self.client.post('/logout', data={'csrf_token': self._session_csrf()}, follow_redirects=False)
        user_csrf_again = self._csrf_from('/login')
        blocked_login_res = self.client.post(
            '/login',
            data={'csrf_token': user_csrf_again, 'email': 'flow@example.com', 'password': 'StrongPass123'},
            follow_redirects=False,
        )
        self.assertEqual(blocked_login_res.status_code, 302)
        self.assertIn('/login', blocked_login_res.headers.get('Location', ''))

        with self.client.session_transaction() as sess:
            self.assertNotEqual(sess.get('role'), 'user')


if __name__ == '__main__':
    unittest.main(verbosity=2)
