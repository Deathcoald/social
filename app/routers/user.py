from fastapi import FastAPI, Response, status, HTTPException, Depends, APIRouter
from sqlalchemy.orm import Session
from .. import models, oauth2, schemas, utils
from ..database import get_db


router = APIRouter(
    prefix="/users",
    tags=['Users']
)


@router.post("/", status_code=status.HTTP_201_CREATED, response_model=schemas.UserOut)
def create_user(user: schemas.UserCreate, db: Session = Depends(get_db)):

    print(f"Received user data: username={user.username}, public_key={user.public_key}")

    hashed_password = utils.hash(user.password)
    
    new_user = models.User(
        username=user.username,
        password=hashed_password,
        public_key=user.public_key,  
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


@router.get('/{id}', response_model=schemas.UserOut)
def get_user(id: int, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == id).first()
    
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"User with id: {id} doesn't exist")
    
    return user
