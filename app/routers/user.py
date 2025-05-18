from fastapi import FastAPI, Response, status, HTTPException, Depends, APIRouter, Request
from sqlalchemy.orm import Session
from typing import List

from .. import models, oauth2, schemas, utils
from ..database import get_db


router = APIRouter(
    prefix="/users",
    tags=['Users']
)


@router.post("/", status_code=status.HTTP_201_CREATED, response_model=schemas.UserOut)
def create_user(user: schemas.UserCreate, db: Session = Depends(get_db)):

    hashed_password = utils.hash(user.password)
    
    new_user = models.User(
        username=user.username,
        password=hashed_password,
        public_key=user.public_key, 
        private_key=user.private_key, 
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return new_user

@router.get("/{user_id}/public-key")
def get_user_public_key(user_id: int, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == user_id).first()

    if not user or not user.public_key:
        raise HTTPException(status_code=404, detail="Публичный ключ не найден")

    return {"public_key": user.public_key}

@router.get("/list", response_model=List[schemas.UserOut])
def get_receivers_list(request: Request, db: Session = Depends(get_db)):

    token = request.headers.get("Authorization")

    if not token:
        raise HTTPException(status_code=401, detail="Token missing")

    user = oauth2.authenticate_ws_user(token.split(" ")[1], db)

    messages = db.query(models.Messages).filter(
        (models.Messages.sender_id == user.id) | (models.Messages.receiver_id == user.id)
    ).all()

    user_ids = set()
    for message in messages:
        if message.sender_id != user.id:
            user_ids.add(message.sender_id)
        if message.receiver_id != user.id:
            user_ids.add(message.receiver_id)

    if not user_ids:
        return []

    users = db.query(models.User).filter(models.User.id.in_(user_ids)).all()
    print(users)

    return [{"username": u.username, "id": u.id} for u in users]

@router.get('/{id}', response_model=schemas.UserOut)
def get_user(id: int, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == id).first()
    
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"User with id: {id} doesn't exist")
    
    return user

