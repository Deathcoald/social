"""AES keys

Revision ID: 55f07c73b391
Revises: 2918468a264f
Create Date: 2025-04-29 16:31:55.685410

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '55f07c73b391'
down_revision: Union[str, None] = '2918468a264f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
     op.create_table(
        'user_aes_keys',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('sender_id', sa.Integer(), nullable=False),
        sa.Column('receiver_id', sa.Integer(), nullable=False),
        sa.Column('sender_aes_key', sa.Text(), nullable=False),
        sa.Column('receiver_aes_key', sa.Text(), nullable=False),
        sa.ForeignKeyConstraint(['sender_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['receiver_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('sender_id', 'receiver_id', name='uix_sender_receiver')
    )



def downgrade() -> None:
    op.drop_table('user_aes_keys')
    pass
