"""add public key

Revision ID: 2918468a264f
Revises: 0048710630a1
Create Date: 2025-04-23 20:59:21.404067

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '2918468a264f'
down_revision: Union[str, None] = '0048710630a1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('public_key', sa.Text(), nullable=False))
    op.add_column('users', sa.Column('private_key', sa.Text(), nullable=False))
    pass


def downgrade() -> None:
    op.drop_column('users', 'public_key')
    op.drop_column('users', 'private_key')
    pass
