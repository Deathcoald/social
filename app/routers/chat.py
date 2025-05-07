import base64

from fastapi import WebSocket, APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from typing import Dict

from .. import models, database, oauth2, AES

router = APIRouter()
active_connections: Dict[int, WebSocket] = {}

@router.websocket("/ws/chat")
async def websocket_endpoint(
    websocket: WebSocket,
    token: str,
    db: Session = Depends(database.get_db)
):
    try:
        user = oauth2.authenticate_ws_user(token, db)
        print(f"Подключение пользователя {user.id}")

        await websocket.accept()
        active_connections[user.id] = websocket

        print("WebSocket соединение установлено.")

        while True:
            data = await websocket.receive_json()
            print(f"Получено сообщение: {data}")

            receiver_id = int(data.get("receiver_id"))
            content = data.get("content")

            if not receiver_id or not content:
                continue

            new_message = models.Messages(
                sender_id=user.id,
                receiver_id=receiver_id,
                content=content,
            )
            db.add(new_message)
            db.commit()

            print(f"Сообщение сохранено в базе данных для {receiver_id}. Отправка...")
            print(active_connections)

            if receiver_id in active_connections:
                print(f"Отправляем сообщение {content} пользователю {receiver_id}")
                await active_connections[receiver_id].send_json({
                    "sender_id": user.id,
                    "receiver_id": receiver_id,
                    "content": content,
                    "created_at": str(new_message.created_at)
                })
                print("otpravleno")

    except HTTPException as e:
        print(f"WebSocket ошибка: {e.detail}")
        await websocket.close(code=1008)


@router.get("/chat/init/{username}")
def init_chat(
    username: str,
    request: Request,
    db: Session = Depends(database.get_db),
):
    token = request.headers.get("Authorization")
    if not token:
        raise HTTPException(status_code=401, detail="Token missing")

    user = oauth2.authenticate_ws_user(token.split(" ")[1], db)

    receiver = db.query(models.User).filter(models.User.email == username).first()
    if not receiver or not receiver.public_key:
        raise HTTPException(status_code=404, detail="Receiver not found")

    user_key = db.query(models.UserKey).filter(
        ((models.UserKey.sender_id == user.id) & (models.UserKey.receiver_id == receiver.id)) |
        ((models.UserKey.sender_id == receiver.id) & (models.UserKey.receiver_id == user.id))
    ).first()

    print(receiver.id)

    if user_key:
        return {
            "receiver_username": receiver.email.split("@")[0],
            "receiver_id": receiver.id,
            "sender_aes_key": user_key.sender_aes_key,
            "receiver_aes_key": user_key.receiver_aes_key
        }
    else:
        aes_key = AES.generate_aes_key()

        sender_aes_key = AES.encrypt_aes_key_with_rsa(user.public_key, aes_key) 
        receiver_aes_key = AES.encrypt_aes_key_with_rsa(receiver.public_key, aes_key) 

        new_user_key = models.UserKey(
                sender_id=user.id,
                receiver_id=int(receiver.id),
                sender_aes_key=base64.b64encode(sender_aes_key).decode(),
                receiver_aes_key = base64.b64encode(receiver_aes_key).decode()
            )
        db.add(new_user_key)
        db.commit()

        return {
            "receiver_username": receiver.email.split("@")[0],
            "receiver_id": int(receiver.id),
            "sender_aes_key": new_user_key.sender_aes_key,
            "receiver_aes_key": new_user_key.receiver_aes_key
        }

@router.get("/chat/history/{receiver_id}")
def get_chat_history(
    receiver_id: int,
    request: Request,
    db: Session = Depends(database.get_db),
):
    token = request.headers.get("Authorization")
    if not token:
        raise HTTPException(status_code=401, detail="Token missing")

    user = oauth2.authenticate_ws_user(token.split(" ")[1], db)

    messages = db.query(models.Messages).filter(
        ((models.Messages.sender_id == user.id) & (models.Messages.receiver_id == receiver_id)) |
        ((models.Messages.sender_id == receiver_id) & (models.Messages.receiver_id == user.id))
    ).order_by(models.Messages.created_at.asc()).all()

    return [
        {
            "sender_id": msg.sender_id,
            "receiver_id": msg.receiver_id,
            "content": msg.content,
            "created_at": str(msg.created_at),
        }
        for msg in messages
    ]
