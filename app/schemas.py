from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import Optional
from pydantic.types import conint


class PostBase(BaseModel):
    title: str
    content: str
    published: bool = True
    owner_id: int


class PostCreate(PostBase):
    pass

class Post(PostBase):
    id: int 
    created_at: datetime

    class Config:
        orm_model = True


class PostOut(BaseModel):
    Post: Post
    votes: int

    class Config:
        orm_model = True

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    public_key : str 

class UserOut(BaseModel):
    id: int
    email: EmailStr

    class Config:
        orm_model = True

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str

class Token_Data(BaseModel):
    id: Optional[int] = None

class LoginResponse(BaseModel):
    access_token: str
    token_type: str

class Vote(BaseModel):
    post_id : int
    dir: conint(le=1)

class Send_message(BaseModel):
    sender_id : int
    receiver_id : int
    content : str

class Out_message(BaseModel):
    id: int
    sender_id: int
    receiver_id: int
    content: str
    timestamp: str

    class Config:
        orm_model = True