import base64

from fastapi import WebSocket, APIRouter, Depends, HTTPException, Request, status, WebSocketDisconnect
from sqlalchemy.orm import Session
from typing import Dict

from .. import models, database, oauth2, AES, schemas, const

router = APIRouter()
user_connections: Dict[int, set[WebSocket]] = {}
chat_members_cache: Dict[int, set[int]] = {}

@router.websocket("/ws/chat")
async def websocket_endpoint(
    websocket: WebSocket,
    token: str,
    chat_id: int,
    db: Session = Depends(database.get_db)
):
    try:
        user = oauth2.authenticate_ws_user(token, db)

        members = db.query(models.ChatMember).filter(models.ChatMember.chat_id == chat_id).all()
        member_ids = {m.user_id for m in members}

        if user.id not in member_ids:
            await websocket.close(1008)
            return

        await websocket.accept()

        user_connections.setdefault(user.id, set()).add(websocket)

        while True:
            data = await websocket.receive_json()

            if data.get("type") == "edit":
                msg_id = data["id"]
                new_content = data["content"]

                msg = db.query(models.Message).filter(models.Message.id == msg_id).first()

                if msg and msg.sender_id == user.id:
                    msg.content = new_content
                    db.commit()
                    db.refresh(msg)

                    if msg.receiver_id in user_connections:
                        await user_connections[msg.receiver_id].send_json({
                            "type": "edit",
                            "id": msg_id,
                            "content": new_content,
                            "sender_id": msg.sender_id,
                            "created_at": str(msg.created_at),
                        })

                continue

            elif data.get("type") == "delete":
                msg_id = data["id"]

                msg = db.query(models.Message).filter(models.Message.id == msg_id).first()

                if msg and msg.sender_id == user.id:
                    receiver_id = msg.receiver_id

                    db.delete(msg)
                    db.commit()

                    if msg.receiver_id in user_connections:

                        await user_connections[msg.receiver_id].send_json({
                            "type": "delete",
                            "id": msg_id
                        })
                continue

            content = data.get("content")

            if not chat_id or not content:
                continue

            temp_id = data.get("temp_id")

            new_message = models.Message(
                sender_id=user.id,
                chat_id=chat_id,
                content=content,
            )
            db.add(new_message)
            db.commit()

            await websocket.send_json({
                "id": new_message.id,
                "temp_id": temp_id,
                "sender_id": user.id,
                "chat_id": chat_id,
                "content": content,
                "created_at": str(new_message.created_at),
            }
            )

            for member_id in member_ids:
                sockets = user_connections.get(member_id, set())
                for ws in sockets:
                    try:
                        await ws.send_json({
                            "id": new_message.id,
                            "sender_id": user.id,
                            "chat_id": chat_id,
                            "content": content,
                            "created_at": str(new_message.created_at),
                        })
                    except RuntimeError:
                        print(f"Ошибка при отправке пользователю {chat_id}: соединение закрыто.")
                        user_connections[user.id].remove(websocket)

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
    message = db.query(models.Message).filter(models.Message.id == message_id).first()

    if not message or message.sender_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    message.content = payload.content

    db.commit()
    return {"status": "updated"}


@router.delete("/chat/messages/{message_id}")
def delete_message(message_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(oauth2.get_current_user)):
    message = db.query(models.Message).filter(models.Message.id == message_id).first()

    if not message or message.sender_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    db.delete(message)
    db.commit()

    return {"status": "deleted"}


@router.post("/chat/create")
def create_chat(
    request: Request,
    chat: schemas.ChatCreate,
    db: Session = Depends(database.get_db),
):
    token = request.headers.get("Authorization")
    if not token:
        raise HTTPException(status_code=401, detail="Token missing")

    owner = oauth2.authenticate_ws_user(token, db)

    member_ids = list(set(chat.members + [owner.id]))

    members = db.query(models.User).filter(
        models.User.id.in_(member_ids)
    ).all()

    if len(members) != len(member_ids):
        raise HTTPException(
            status_code=404,
            detail="Some users not found"
        )
    if len(set(chat.members)) == 0:
        raise HTTPException(
            status_code=400,
            detail="You can not create chat with yourself"
        )

    new_chat = models.Chat(
        owner_id=owner.id,
        is_group=(chat.type == const.ChatType.GROUP),
        name=chat.name if chat.type == const.ChatType.GROUP else None
    )

    db.add(new_chat)
    db.commit()
    db.refresh(new_chat)

    for uid in member_ids:
        db.add(models.ChatMember(
            chat_id=new_chat.id,
            user_id=uid,
            role=const.MemberType.OWNER if uid == owner.id else const.MemberType.MEMBER
        ))

    aes_key = AES.generate_aes_key()

    for member in members:
        encrypted = AES.encrypt_aes_key_with_rsa(
            member.public_key,
            aes_key
        )

        db.add(models.ChatKey(
            chat_id=new_chat.id,
            user_id=member.id,
            encrypted_aes_key=base64.b64encode(encrypted).decode()
        ))

    db.commit()

    return {
        "chat_id": new_chat.id,
        "type": chat.type,
        "members": member_ids
    }


@router.get("/chat/history/{chat_id}")
def get_chat_history(
    chat_id: int,
    request: Request,
    db: Session = Depends(database.get_db),
):
    token = request.headers.get("Authorization")
    if not token:
        raise HTTPException(status_code=401, detail="Token missing")

    user = oauth2.authenticate_ws_user(token, db)

    member = db.query(models.ChatMember).filter(
        models.ChatMember.chat_id == chat_id,
        models.ChatMember.user_id == user.id
    ).first()

    if not member:
        raise HTTPException(status_code=403, detail="Not a member")

    messages = db.query(models.Message).filter(models.Message.chat_id == chat_id
    ).order_by(models.Message.created_at.asc()).all()

    return [
        {
            "id": msg.id,
            "chat_id": chat_id,
            "sender_id": msg.sender_id,
            "content": msg.content,
            "created_at": str(msg.created_at),
        }
        for msg in messages
    ]
