"""rename identity columns to username

Revision ID: 8b7e1e3a2f6c
Revises: 15722b83e2fa
Create Date: 2026-02-13 22:15:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect, text


# revision identifiers, used by Alembic.
revision = '8b7e1e3a2f6c'
down_revision = '15722b83e2fa'
branch_labels = None
depends_on = None


def _has_column(bind, table_name, column_name):
    inspector = inspect(bind)
    return any(col['name'] == column_name for col in inspector.get_columns(table_name))


def _copy_column_data(bind, table_name, source_column, target_column):
    bind.execute(
        text(
            f"UPDATE `{table_name}` "
            f"SET `{target_column}` = `{source_column}` "
            f"WHERE `{target_column}` IS NULL AND `{source_column}` IS NOT NULL"
        )
    )


def _rename_identity_column(bind, table_name, old_column, new_column='username'):
    has_old = _has_column(bind, table_name, old_column)
    has_new = _has_column(bind, table_name, new_column)

    if not has_old and not has_new:
        with op.batch_alter_table(table_name) as batch_op:
            batch_op.add_column(sa.Column(new_column, sa.String(length=150), nullable=True))
        return

    if has_old and not has_new:
        with op.batch_alter_table(table_name) as batch_op:
            batch_op.add_column(sa.Column(new_column, sa.String(length=150), nullable=True))

    if _has_column(bind, table_name, old_column) and _has_column(bind, table_name, new_column):
        _copy_column_data(bind, table_name, old_column, new_column)
        with op.batch_alter_table(table_name) as batch_op:
            batch_op.drop_column(old_column)


def upgrade():
    bind = op.get_bind()

    _rename_identity_column(bind, 'workout', 'user_identity')
    _rename_identity_column(bind, 'daily_summary', 'user_identity')
    _rename_identity_column(bind, 'weekly_goal', 'user_identity')
    _rename_identity_column(bind, 'import_export_history', 'user_identity')
    _rename_identity_column(bind, 'user_settings', 'user_identity')
    _rename_identity_column(bind, 'admin_audit_log', 'admin_identity')

    if _has_column(bind, 'user', 'identity_name'):
        with op.batch_alter_table('user') as batch_op:
            batch_op.drop_column('identity_name')


def downgrade():
    bind = op.get_bind()

    # Restore user.identity_name
    if not _has_column(bind, 'user', 'identity_name'):
        with op.batch_alter_table('user') as batch_op:
            batch_op.add_column(sa.Column('identity_name', sa.String(length=150), nullable=True))
        if _has_column(bind, 'user', 'username'):
            _copy_column_data(bind, 'user', 'username', 'identity_name')

    # Restore identity columns from username
    restore_map = (
        ('workout', 'user_identity'),
        ('daily_summary', 'user_identity'),
        ('weekly_goal', 'user_identity'),
        ('import_export_history', 'user_identity'),
        ('user_settings', 'user_identity'),
        ('admin_audit_log', 'admin_identity'),
    )

    for table_name, restored_column in restore_map:
        has_restored = _has_column(bind, table_name, restored_column)
        has_username = _has_column(bind, table_name, 'username')

        if not has_restored:
            with op.batch_alter_table(table_name) as batch_op:
                batch_op.add_column(sa.Column(restored_column, sa.String(length=150), nullable=True))

        if _has_column(bind, table_name, 'username') and _has_column(bind, table_name, restored_column):
            _copy_column_data(bind, table_name, 'username', restored_column)

        if has_username:
            with op.batch_alter_table(table_name) as batch_op:
                batch_op.drop_column('username')
