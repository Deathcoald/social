from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, LargeBinary, Text, UniqueConstraint
from sqlalchemy.sql.expression import text
from sqlalchemy.sql.sqltypes import TIMESTAMP

from .database import Base

class Post(Base):
    __tablename__ = "posts"

    id = Column(Integer, primary_key=True, nullable=False)
    title = Column(String, nullable=False)
    content = Column(String, nullable=False)
    published = Column(Boolean, server_default='True', nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=text('now()'))
    owner_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, nullable=False)
    email = Column(String, nullable=False, unique=True)
    password = Column(String, nullable=False)
    private_key = Column(String, nullable=False)
    public_key = Column(String, nullable=False)

class Vote(Base):
    __tablename__  = "votes"

    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), 
                     primary_key=True)
    post_id = Column(Integer, ForeignKey("posts.id", ondelete="CASCADE"), 
                     primary_key=True)

class Messages(Base):
    __tablename__ = "chats"

    id = Column(Integer, primary_key=True, nullable=False)
    sender_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    receiver_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    content = Column(Text, nullable=False)
    signature = Column(Text, nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=text('now()'))
    is_read = Column(Boolean, default=False, nullable=False)

class UserKey(Base):
    __tablename__ = "user_aes_keys"

    id = Column(Integer, primary_key=True, nullable=False)
    sender_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    receiver_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    sender_aes_key = Column(Text, nullable=False)
    receiver_aes_key = Column(Text, nullable=False)

    __table_args__ = (
        UniqueConstraint('sender_id', 'receiver_id', name='unique_sender_receiver'),
    )
