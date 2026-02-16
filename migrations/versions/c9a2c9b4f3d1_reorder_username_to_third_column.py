"""reorder username as third column in non-user tables

Revision ID: c9a2c9b4f3d1
Revises: 8b7e1e3a2f6c
Create Date: 2026-02-13 22:45:00.000000
"""

from alembic import op
from sqlalchemy import inspect, text


# revision identifiers, used by Alembic.
revision = 'c9a2c9b4f3d1'
down_revision = '8b7e1e3a2f6c'
branch_labels = None
depends_on = None


def _has_column(bind, table_name, column_name):
    inspector = inspect(bind)
    return any(col['name'] == column_name for col in inspector.get_columns(table_name))


def _move_username_after(bind, table_name, after_column):
    if _has_column(bind, table_name, 'username') and _has_column(bind, table_name, after_column):
        op.execute(
            text(
                f"ALTER TABLE `{table_name}` "
                f"MODIFY COLUMN `username` VARCHAR(150) NULL AFTER `{after_column}`"
            )
        )


def upgrade():
    bind = op.get_bind()
    if bind.dialect.name != 'mysql':
        # Column-order migration is MySQL-specific.
        return

    # Keep user table unchanged as requested.
    _move_username_after(bind, 'workout', 'user_id')
    _move_username_after(bind, 'daily_summary', 'user_id')
    _move_username_after(bind, 'weekly_goal', 'user_id')
    _move_username_after(bind, 'user_settings', 'user_id')
    _move_username_after(bind, 'import_export_history', 'user_id')
    _move_username_after(bind, 'admin_audit_log', 'admin_id')


def downgrade():
    bind = op.get_bind()
    if bind.dialect.name != 'mysql':
        # No-op for non-MySQL backends.
        return

    # Move username back to tail positions used before this migration.
    _move_username_after(bind, 'workout', 'archived')
    _move_username_after(bind, 'daily_summary', 'total_duration')
    _move_username_after(bind, 'weekly_goal', 'updated_at')
    _move_username_after(bind, 'user_settings', 'notifications')
    _move_username_after(bind, 'import_export_history', 'created_at')
    _move_username_after(bind, 'admin_audit_log', 'created_at')
