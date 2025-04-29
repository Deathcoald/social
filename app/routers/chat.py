from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from sqlalchemy.orm import Session
from typing import Dict
import base64
from .. import models, database, RSA, oauth2, AES

router = APIRouter()

active_connections: Dict[int, WebSocket] = {}  

@router.websocket("/ws/chat")
async def websocket_endpoint(
    websocket: WebSocket,
    token: str,
    password: str,
    db: Session = Depends(database.get_db)
):
    try:
        user = oauth2.authenticate_ws_user(token, db)
        await websocket.accept()
        active_connections[user.id] = websocket

        receiver_id = None

        while True:
            data = await websocket.receive_json()

            if receiver_id is None:
                receiver_id = data.get("receiver_id")
                if receiver_id is None:
                    await websocket.send_json({"error": "receiver_id обязателен для начала общения."})
                    continue

                messages = await get_messages(user.id, receiver_id, db)

                user_key = db.query(models.UserKey).filter(
                    ((models.UserKey.sender_id == user.id) & (models.UserKey.receiver_id == receiver_id)) |
                    ((models.UserKey.sender_id == receiver_id) & (models.UserKey.receiver_id == user.id))
                ).first()

                if user_key:
                    # 🔧 ИСПРАВЛЕНО: дешифруем AES-ключ в зависимости от роли пользователя
                    if user.id == user_key.sender_id:
                        encrypted_key = base64.b64decode(user_key.sender_aes_key)
                    else:
                        encrypted_key = base64.b64decode(user_key.receiver_aes_key)
                    
                    aes_key = AES.decrypt_aes_key_with_rsa(user.private_key, password, encrypted_key)

                    for msg in messages:
                        try:
                            encrypted_message_bytes = base64.b64decode(msg.content)
                            decrypted_bytes = AES.decrypt_message_with_aes(aes_key, encrypted_message_bytes)
                            decrypted_text = decrypted_bytes.decode('utf-8')

                            await websocket.send_json({
                                "sender_id": msg.sender_id,
                                "receiver_id": msg.receiver_id,
                                "content": decrypted_text,
                                "created_at": str(msg.created_at)
                            })
                        except Exception as e:
                            print(f"Ошибка дешифровки сообщения ID {msg.id}: {e}")

                    continue
                else:
                    continue

            content = data.get("content")
            if content is None:
                await websocket.send_json({"error": "content обязателен."})
                continue

            content_bytes = content.encode('utf-8')

            receiver = db.query(models.User).filter(models.User.id == receiver_id).first()
            if not receiver or not receiver.public_key:
                await websocket.send_json({"error": "receiver_id некорректен."})
                continue

            user_key = db.query(models.UserKey).filter(
                ((models.UserKey.sender_id == user.id) & (models.UserKey.receiver_id == receiver_id)) |
                ((models.UserKey.sender_id == receiver_id) & (models.UserKey.receiver_id == user.id))
            ).first()

            if user_key:
                # 🔧 ИСПРАВЛЕНО: дешифруем AES-ключ в зависимости от роли пользователя
                if user.id == user_key.sender_id:
                    encrypted_key = base64.b64decode(user_key.sender_aes_key)
                else:
                    encrypted_key = base64.b64decode(user_key.receiver_aes_key)

                aes_key = AES.decrypt_aes_key_with_rsa(user.private_key, password, encrypted_key)
            else:
                rsa_aes_key = AES.generate_aes_key()    
                sender_encrypted_aes_key = AES.encrypt_aes_key_with_rsa(user.public_key, rsa_aes_key)
                receiver_encrypted_aes_key = AES.encrypt_aes_key_with_rsa(receiver.public_key, rsa_aes_key)

                new_user_key = models.UserKey(
                    sender_id=user.id,
                    receiver_id=receiver_id,
                    sender_aes_key=base64.b64encode(sender_encrypted_aes_key).decode(),
                    receiver_aes_key=base64.b64encode(receiver_encrypted_aes_key).decode()
                )

                db.add(new_user_key)
                db.commit()

                aes_key = rsa_aes_key  # 🔧 ИСПРАВЛЕНО: используем сгенерированный AES-ключ

            encrypted_message = AES.encrypt_message_with_aes(aes_key, content)
            print("kashira")

            signature = RSA.create_sign(user.private_key, password, content_bytes)

            encoded_message = base64.b64encode(encrypted_message).decode()
            encoded_signature = base64.b64encode(signature).decode()

            new_message = models.Messages(
                sender_id=user.id,
                receiver_id=receiver_id,
                content=encoded_message,
                signature=encoded_signature
            )
            db.add(new_message)
            db.commit()

            if receiver_id in active_connections:
                try:
                    decoded_signature = base64.b64decode(new_message.signature)
                    RSA.verify_singature(user.public_key, decoded_signature, content_bytes)

                    encrypted_bytes = base64.b64decode(new_message.content)
                    decrypted_bytes = AES.decrypt_message_with_aes(aes_key, encrypted_bytes)
                    decrypted_text = decrypted_bytes.decode('utf-8')

                    await active_connections[receiver_id].send_json({
                        "sender_id": user.id,
                        "content": decrypted_text,
                        "created_at": str(new_message.created_at)
                    })
                except Exception as e:
                    print(f"Ошибка подписи/дешифровки: {e}")
                    await websocket.send_json({"error": "Ошибка обработки сообщения."})

    except Exception as e:
        print(f"WebSocket error: {e}")
        await websocket.close()


async def get_messages(sender_id, receiver_id, db: Session):
    messages = db.query(models.Messages).filter(
        ((models.Messages.sender_id == sender_id) & (models.Messages.receiver_id == receiver_id)) |
        ((models.Messages.sender_id == receiver_id) & (models.Messages.receiver_id == sender_id))
    ).order_by(models.Messages.created_at.asc()).all()

    return messages
