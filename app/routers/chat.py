import base64

from fastapi import WebSocket, APIRouter, Depends, HTTPException, Request, status, WebSocketDisconnect
from sqlalchemy.orm import Session
from typing import Dict

from .. import models, database, oauth2, AES, schemas

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

            print(f"Тип запроса: {data.get('type')}")

            if data.get("type") == "edit":
                msg_id = data["id"]
                new_content = data["content"]

                msg = db.query(models.Messages).filter(models.Messages.id == msg_id).first()

                if msg and msg.sender_id == user.id:

                    msg.content = new_content
                    
                    db.commit()
                    db.refresh(msg)

                    if msg.receiver_id in active_connections:
                        await active_connections[msg.receiver_id].send_json({
                            "type": "edit",
                            "id": msg_id,
                            "content": new_content,
                            "sender_id": msg.sender_id,
                            "created_at": str(msg.created_at),
                        })

                continue

            elif data.get("type") == "delete":
                msg_id = data["id"]

                msg = db.query(models.Messages).filter(models.Messages.id == msg_id).first()

                print(msg)
                print(msg.sender_id)
                print(user.id)

                if msg and msg.sender_id == user.id:
                    receiver_id = msg.receiver_id

                    db.delete(msg)
                    db.commit()

                    print(active_connections)

                    if msg.receiver_id in active_connections:
                        print(active_connections)
                        await active_connections[msg.receiver_id].send_json({
                                "type": "delete",
                                "id": msg_id
                            })
                continue

            receiver_id = int(data.get("receiver_id"))
            content = data.get("content")

            if not receiver_id or not content:
                continue
               
            temp_id = data.get("temp_id")

            new_message = models.Messages(
                sender_id=user.id,
                receiver_id=receiver_id,
                content=content,
            )
            db.add(new_message)
            db.commit()


            await websocket.send_json({
            "id": new_message.id,
            "temp_id": temp_id,
            "sender_id": user.id,
            "receiver_id": receiver_id,
            "content": content,
            "created_at": str(new_message.created_at),
            })


            if receiver_id in active_connections:
                try:
                    await active_connections[receiver_id].send_json({
                        "id": new_message.id,
                        "sender_id": user.id,
                        "receiver_id": receiver_id,
                        "content": content,
                        "created_at": str(new_message.created_at)
                    })
                except RuntimeError:
                    print(f"Ошибка при отправке пользователю {receiver_id}: соединение закрыто.")
                    del active_connections[receiver_id]

    except HTTPException as e:
        print(f"WebSocket ошибка: {e.detail}")
        await websocket.close(code=1008)


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: str, db: Session = Depends(database.get_db)):
    await websocket.accept()
    user = oauth2.authenticate_ws_user(token, db)
    active_connections[user.id] = websocket
    try:
        while True:
            data = await websocket.receive_json()

    except WebSocketDisconnect:
        print(f"Пользователь {user.id} отключился")
        del active_connections[user.id]


@router.put("/chat/messages/{message_id}")
def update_message(message_id: int, payload: schemas.Update_message, db: Session = Depends(database.get_db), current_user: models.User = Depends(oauth2.get_current_user)):
    message = db.query(models.Messages).filter(models.Messages.id == message_id).first()

    print(f"Current user ID: {current_user.id}")
    print(f"Message sender ID: {message.sender_id if message else 'Message not found'}")

    if not message or message.sender_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    message.content = payload.content

    db.commit()
    return {"status": "updated"}


@router.delete("/chat/messages/{message_id}")
def delete_message(message_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(oauth2.get_current_user)):
    message = db.query(models.Messages).filter(models.Messages.id == message_id).first()

    if not message or message.sender_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    return {"status": "deleted"}



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

    receiver = db.query(models.User).filter(models.User.username == username).first()
    if not receiver or not receiver.public_key:
        raise HTTPException(status_code=404, detail="Receiver not found")

    if receiver.id == user.id:
        raise HTTPException(status_code=400, detail="Нельзя создать чат с самим собой")

    user_key = db.query(models.UserKey).filter(
        ((models.UserKey.sender_id == user.id) & (models.UserKey.receiver_id == receiver.id)) |
        ((models.UserKey.sender_id == receiver.id) & (models.UserKey.receiver_id == user.id))
    ).first()

    if user_key:
        return {
            "sender_id": user_key.sender_id,
            "receiver_username": receiver.username,
            "receiver_id": user_key.receiver_id,
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
            "sender_id": new_user_key.sender_id,
            "receiver_username": receiver.username,
            "receiver_id": new_user_key.receiver_id,
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
            "id": msg.id,
            "sender_id": msg.sender_id,
            "receiver_id": msg.receiver_id,
            "content": msg.content,
            "created_at": str(msg.created_at),
        }
        for msg in messages
    ]
