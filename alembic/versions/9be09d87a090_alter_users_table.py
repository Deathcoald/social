"""alter users table

Revision ID: 9be09d87a090
Revises: 55f07c73b391
Create Date: 2026-05-07 19:27:46.853322

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9be09d87a090'
down_revision: Union[str, None] = '55f07c73b391'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column('users', 'email', new_column_name='username')


def downgrade() -> None:
    op.alter_column('users', 'username', new_column_name='email')

