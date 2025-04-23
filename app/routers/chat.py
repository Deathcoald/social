from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from sqlalchemy.orm import Session
from typing import Dict
from .. import models, database, oauth2

router = APIRouter()

active_connections: Dict[int, WebSocket] = {}  # user_id: websocket

@router.websocket("/ws/chat")
async def websocket_endpoint(websocket: WebSocket, token: str, db: Session = Depends(database.get_db)):
    try:
        user = oauth2.authenticate_ws_user(token, db)

        await websocket.accept()
        active_connections[user.id] = websocket

        while True:
            data = await websocket.receive_json()
            receiver_id = data["receiver_id"]
            content = data["content"]

            new_message = models.Messages(
                sender_id=user.id,
                receiver_id=receiver_id,
                content=content,
            )
            db.add(new_message)
            db.commit()
            print(f"Message saved with ID: {new_message.id}")

            if receiver_id in active_connections:
                await active_connections[receiver_id].send_json({
                    "sender_id": user.id,
                    "content": content,
                    "created_at": str(new_message.created_at),
                })

    except Exception as e:
        print("WebSocket auth failed:", str(e))
        return
