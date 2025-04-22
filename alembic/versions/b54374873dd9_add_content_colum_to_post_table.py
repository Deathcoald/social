"""add content colum to post table

Revision ID: b54374873dd9
Revises: 1f041d073075
Create Date: 2025-04-21 15:35:49.721273

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b54374873dd9'
down_revision: Union[str, None] = '1f041d073075'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('posts', sa.Column('content', sa.String(), nullable=False))
    pass


def downgrade() -> None:
    op.drop_column('posts', 'content')
    pass
