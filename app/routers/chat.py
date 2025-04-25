from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from sqlalchemy.orm import Session
from typing import Dict
from .. import models, database, oauth2

router = APIRouter()

active_connections: Dict[int, WebSocket] = {}  

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

            content_bytes = content.encode('utf8')

            encrypt_message = oauth2.encryp_message(user.public_key, content_bytes)

            sender_sign = oauth2.create_sign(user.private_key, content_bytes)

            new_message = models.Messages(
                sender_id=user.id,
                receiver_id=receiver_id,
                content=encrypt_message,
            )
            db.add(new_message)
            db.commit()
            print(f"Message saved with ID: {new_message.id}")

            if receiver_id in active_connections:
                try:
                    oauth2.verify_singature(user.public_key, sender_sign, content_bytes)
                    decrypt_content = oauth2.decrypt_message(user.private_key, encrypt_message)
                    decrypted_content_str = decrypt_content.decode('utf-8')

                    await active_connections[receiver_id].send_json({
                        "sender_id": user.id,
                        "content": decrypted_content_str,
                        "created_at": str(new_message.created_at),
                    })
                except Exception as e:
                    print(f"Error verifying signature or decrypting message: {e}")
                    
                    await websocket.send_json({"error": "Message verification failed."})

    except Exception as e:
        print("WebSocket auth failed:", str(e))
        return
