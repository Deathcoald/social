"""add last_message at

Revision ID: 4c6c9bd5628f
Revises: 5a07004ad707
Create Date: 2026-05-14 06:49:23.457205

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4c6c9bd5628f'
down_revision: Union[str, None] = '5a07004ad707'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'chats',
        sa.Column(
            'last_message_at',
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text('now()')
        )
    )


def downgrade() -> None:
    op.drop_column('chats', 'last_message_at')
