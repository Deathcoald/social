import base64
from collections import defaultdict

from fastapi import WebSocket, APIRouter, Depends, HTTPException, Request, status, WebSocketDisconnect
from sqlalchemy import func
from sqlalchemy.orm import Session
from typing import Dict

from .. import models, database, oauth2, AES, schemas, const
from ..database import get_db

router = APIRouter()
user_connections: Dict[int, set[WebSocket]] = defaultdict(set)
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

        user_connections[user.id].add(websocket)

        try:
            while True:
                data = await websocket.receive_json()

                await handle_ws_message(user, chat_id, data, db)

        except WebSocketDisconnect:
            user_connections[user.id].remove(websocket)

    except HTTPException as e:
        print(f"WebSocket ошибка: {e.detail}")
        await websocket.close(code=1008)

async def send_to_user(user_id: int, data: dict):
    sockets = user_connections.get(user_id, set())

    for ws in list(sockets):
        try:
            await ws.send_json(data)
        except:
            sockets.remove(ws)

async def broadcast_to_chat(user_id: int, chat_id: int, data: dict, db: Session):
    members = db.query(models.ChatMember).filter(
        models.ChatMember.chat_id == chat_id
    ).all()

    for m in members:
        if m.user_id == user_id:
            continue
        sockets = user_connections.get(m.user_id, set())

        for ws in list(sockets):
            try:
                await ws.send_json(data)
            except:
                sockets.remove(ws)

async def handle_send(user, chat_id, data, db):
    content = data.get("content")
    temp_id = data.get("temp_id")

    if not content:
        return

    msg = models.Message(
        sender_id=user.id,
        chat_id=chat_id,
        content=content
    )

    db.add(msg)
    db.commit()
    db.refresh(msg)

    chat = db.query(models.Chat).filter(
        models.Chat.id == chat_id
    ).first()

    chat.last_message_at = func.now()

    db.commit()
    db.refresh(chat)

    payload = {
        "id": msg.id,
        "temp_id": temp_id,
        "sender_id": user.id,
        "chat_id": chat_id,
        "content": msg.content,
        "created_at": str(msg.created_at),
        "is_read": False,
    }

    await send_to_user(user.id, payload)

    await broadcast_to_chat(user.id, chat_id, payload, db)

@router.post("/chat/read/{chat_id}")
async def mark_read(chat_id: int, db: Session = Depends(get_db), current_user=Depends(oauth2.get_current_user)):
    messages = db.query(models.Message).filter(
        models.Message.chat_id == chat_id,
        models.Message.sender_id != current_user.id,
        models.Message.is_read == False
    ).all()

    msg_ids = [m.id for m in messages]

    db.query(models.Message).filter(
        models.Message.id.in_(msg_ids)
    ).update({"is_read": True}, synchronize_session=False)

    db.commit()

    for m in messages:
        await broadcast_to_chat(
            user_id=current_user.id,
            chat_id=chat_id,
            data={
                "type": "read",
                "id": m.id
            },
            db=db
        )

    return {"status": "ok"}

async def handle_ws_message(user, chat_id, data, db):
    msg_type = data.get("type")

    if msg_type == "edit":
        await handle_edit(user, data, db)
        return

    if msg_type == "delete":
        await handle_delete(user, data, db)
        return
    if msg_type == "read":
        await handle_read(user, data, db)
        return

    await handle_send(user, chat_id, data, db)

async def handle_read(user, data, db):
    chat_id = data.get("chat_id")

    if not chat_id:
        return

    messages = db.query(models.Message).filter(
        models.Message.chat_id == chat_id,
        models.Message.sender_id != user.id,
        models.Message.is_read == False
    ).all()

    msg_ids = [m.id for m in messages]

    if not msg_ids:
        return

    db.query(models.Message).filter(
        models.Message.id.in_(msg_ids)
    ).update({"is_read": True}, synchronize_session=False)

    db.commit()

    for m in messages:
        await broadcast_to_chat(
            user_id=user.id,
            chat_id=chat_id,
            data={
                "type": "read",
                "id": m.id
            },
            db=db
        )

async def handle_delete(user, data, db):
    msg = db.query(models.Message).filter(
        models.Message.id == data["id"]
    ).first()

    if not msg or msg.sender_id != user.id:
        return

    chat_id = msg.chat_id

    db.delete(msg)
    db.commit()

    await broadcast_to_chat(user_id=user.id, chat_id=chat_id, data={
        "type": "delete",
        "id": msg.id
    }, db=db)

async def handle_edit(user, data, db):
    msg = db.query(models.Message).filter(
        models.Message.id == data["id"]
    ).first()

    if not msg or msg.sender_id != user.id:
        return

    msg.content = data["content"]
    db.commit()

    await broadcast_to_chat(
        user_id=user.id,
        chat_id=msg.chat_id,
        data={
            "type": "edit",
            "id": msg.id,
            "content": msg.content
        },
        db=db
    )

@router.put("/chat/messages/{message_id}")
def update_message(message_id: int, payload: schemas.Update_message, db: Session = Depends(database.get_db), current_user: models.User = Depends(oauth2.get_current_user)):
    message = db.query(models.Message).filter(models.Message.id == message_id).first()

    if not message or message.sender_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    message.content = payload.content

    db.commit()
    return {"status": "updated"}

@router.get("/chat/chat_key")
def get_chat_key(
    chat_id: int,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(oauth2.get_current_user)
):
    chat_key = db.query(models.ChatKey).filter(
        models.ChatKey.chat_id == chat_id,
        models.ChatKey.user_id == current_user.id
    ).first()

    if not chat_key:
        raise HTTPException(
            status_code=404,
            detail="Chat key not found"
        )

    return {
        "chat_key": chat_key.encrypted_aes_key
    }

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

    token = token.split(" ")[1]
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
    token = token.split(" ")[1]
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
            "is_read": msg.is_read,
        }
        for msg in messages
    ]


@router.get("/chat/{chat_id}")
def get_chat(chat_id: int, request: Request, db: Session = Depends(database.get_db)):
    token = request.headers.get("Authorization")

    if not token:
        raise HTTPException(
            status_code=401,
            detail="Token missing"
        )
    token = token.split(" ")[1]

    user = oauth2.authenticate_ws_user(
        token,
        db
    )

    chat = db.query(models.Chat).filter(
        models.Chat.id == chat_id
    ).first()

    if chat.name:
        name = chat.name
    else:
        other_members = db.query(models.ChatMember).filter(
            models.ChatMember.chat_id == chat.id,
            models.ChatMember.user_id != user.id
        ).all()

        other_user_ids = [m.user_id for m in other_members]

        other_users = db.query(models.User).filter(
            models.User.id.in_(other_user_ids)
        ).all()

        name = ", ".join(u.username for u in other_users)

    return {
        "chat": {
            "id": chat.id,
            "name": name,
            "is_group": chat.is_group
        }
    }

@router.get("/chats")
def get_chats(
    request: Request,
    db: Session = Depends(get_db)
):
    token = request.headers.get("Authorization")

    if not token:
        raise HTTPException(
            status_code=401,
            detail="Token missing"
        )
    token = token.split(" ")[1]

    user = oauth2.authenticate_ws_user(
        token,
        db
    )

    memberships = db.query(models.ChatMember).filter(
        models.ChatMember.user_id == user.id
    ).all()

    chat_ids = [m.chat_id for m in memberships]

    chats = db.query(models.Chat).filter(
        models.Chat.id.in_(chat_ids)
    ).order_by(models.Chat.last_message_at.desc()).all()

    result = []

    for chat in chats:
        if chat.name:
            name = chat.name
        else:
            other_members = db.query(models.ChatMember).filter(
                models.ChatMember.chat_id == chat.id,
                models.ChatMember.user_id != user.id
            ).all()

            other_user_ids = [m.user_id for m in other_members]

            other_users = db.query(models.User).filter(
                models.User.id.in_(other_user_ids)
            ).all()

            name = ", ".join(u.username for u in other_users)

        result.append({
            "id": chat.id,
            "name": name,
            "is_group": chat.is_group
        })

    return result