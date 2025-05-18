import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { jwtDecode } from "jwt-decode";
import { JwtPayload } from 'jwt-decode';
import '../styles/Chat.css';
import FileUpload from './FileUpload';

import {
  aesEncrypt,
  aesDecrypt,
  decryptAesKeyWithRsa,
} from '../crypto/aes';

type ChatMessage = {
  id: number;
  senderId: number;
  receiverId?: number;
  content: string;
  createdAt?: string;
};

function isImage(url: string): boolean {
  return /\.(jpg|jpeg|png|gif|webp)$/i.test(url);
}

export default function Chat() {
  const { receiverId, receiverName } = useParams();
  const decodedReceiverName = receiverName ? decodeURIComponent(receiverName) : '';
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [message, setMessage] = useState('');
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [aesKey, setAesKey] = useState<CryptoKey | null>(null);
  const navigate = useNavigate();

  const getUserIdFromToken = (token: string): number | null => {
    try {
      const decoded = jwtDecode<JwtPayload>(token);
      return decoded && 'user_id' in decoded ? (decoded as any).user_id : null;
    } catch {
      return null;
    }
  };

  const currentUserId = getUserIdFromToken(token);

  const handleGoBack = () => {
    navigate("/chat-init"); 
  };

  useEffect(() => {
    const initChat = async () => {
      const encryptedSenderKeyBase64 = localStorage.getItem("chatAesKeyEncrypted");
      const username = sessionStorage.getItem("currentUsername");
      const privateKeyPem = localStorage.getItem(`encrypyionPrivateKey-${username}`);
      
      if (!encryptedSenderKeyBase64 || !privateKeyPem) {
        console.error("Не хватает данных для расшифровки AES-ключа");
        return;
      }

      try {
        const aesKey = await decryptAesKeyWithRsa(encryptedSenderKeyBase64, privateKeyPem);
        setAesKey(aesKey);

        const rawKey = await window.crypto.subtle.exportKey("raw", aesKey);
        const keyBytes = Array.from(new Uint8Array(rawKey));
        sessionStorage.setItem(`aesKey-${receiverId}`, JSON.stringify(keyBytes));
      } catch (err) {
        console.error("Ошибка при расшифровке AES-ключа:", err);
      }
    };

    initChat();
  }, [receiverId]);

  useEffect(() => {
    const fetchHistory = async () => {
      if (!token || !receiverId || !aesKey) 
        return;

      try {
        const response = await fetch(`http://localhost:8000/chat/history/${receiverId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await response.json();
        
        const decryptedMessages: ChatMessage[] = [];

        for (const msg of data) {
          try {
            const decryptedContent = await aesDecrypt(msg.content, aesKey);
            decryptedMessages.push({
              id: msg.id,
              senderId: msg.sender_id,
              content: decryptedContent,
              createdAt: msg.created_at,
            });
          } catch (err) {
            console.error("Ошибка расшифровки истории сообщения:", err);
          }
        }

        setMessages(decryptedMessages);
      } catch (err) {
        console.error("Ошибка загрузки истории сообщений:", err);
      }
    };

    fetchHistory();
  }, [token, receiverId, aesKey]);

  useEffect(() => {
    if (!token || !receiverId || !aesKey) return;

    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const socket = new WebSocket(`${protocol}://localhost:8000/ws/chat?token=${token}`);

    socket.onopen = () => {
      console.log("WebSocket открыт");
      setWs(socket);
    };

    socket.onmessage = async (event) => {
      const data = JSON.parse(event.data);
      
      console.log(data.type)

      if (data.type === "edit" && aesKey) {
        try {
          const decrypted = await aesDecrypt(data.content, aesKey);
          setMessages((prev) =>
            prev.map((m) => (m.id === data.id ? { ...m, content: decrypted } : m))
          );
        } catch (err) {
          console.error("Ошибка расшифровки изменённого сообщения:", err);
        }
        return;
      }

      if (data.type === "delete") 
        {
        console.log(data.type)

        setMessages((prev) => prev.filter((m) => m.id !== data.id));
        return;
      }

      if (data.content && aesKey) {
        try {
          const decryptedMessage = await aesDecrypt(data.content, aesKey);
          setMessages((prev) => [...prev, {
            id: data.id,
            senderId: data.sender_id,
            content: decryptedMessage,
            createdAt: data.created_at,
          }]);
        } catch (error) {
          console.error("Ошибка при расшифровке сообщения:", error);
        }
      }
    };

    socket.onclose = () => {
      console.log("WebSocket закрыт");
    };

    socket.onerror = (e) => {
      console.error("WebSocket ошибка:", e);
    };

    return () => {
      socket.close();
    };
  }, [token, receiverId, aesKey]);

  const handleSendMessage = async () => {
    if (!aesKey || !ws || ws.readyState !== WebSocket.OPEN || !message.trim()) return;

    try {
      const encryptedMessage = await aesEncrypt(aesKey, message);
      const tempId = Date.now();

      const msg = {
        content: encryptedMessage,
        receiver_id: receiverId,
        temp_id: tempId,
      };

      const waitForResponse = new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("Ответ от сервера не получен")), 5000);

        const handleResponse = async (event: MessageEvent) => {
          try {
            const data = JSON.parse(event.data);
            if (data.temp_id === tempId && data.id) {
              const decrypted = await aesDecrypt(data.content, aesKey);
              ws.removeEventListener("message", handleResponse);
              clearTimeout(timeout);
              resolve();
            }
          } catch (err) {
            console.error("Ошибка обработки ответа:", err);
            clearTimeout(timeout);
            reject(err);
          }
        };

        ws.addEventListener("message", handleResponse);
      });

      ws.send(JSON.stringify(msg));
      setMessage('');
      await waitForResponse;

    } catch (error) {
      console.error("Ошибка при отправке сообщения:", error);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await fetch(`http://localhost:8000/chat/messages/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      setMessages((prev) => prev.filter((msg) => msg.id !== id));
      ws?.send(JSON.stringify({ type: "delete", id }));
    } catch (err) {
      console.error("Ошибка при удалении:", err);
    }
  };

  const handleEdit = async (msg: ChatMessage) => {
    const newText = prompt("Новое сообщение:", msg.content);
    if (!newText || !aesKey) return;

    try {
      const encrypted = await aesEncrypt(aesKey, newText);
      ws?.send(JSON.stringify({ type: "edit", id: msg.id, content: encrypted }));
      setMessages((prev) =>
        prev.map((m) => (m.id === msg.id ? { ...m, content: newText } : m))
      );
    } catch (err) {
      console.error("Ошибка при редактировании:", err);
    }
  };

  return (
    <div className="chat-container">
      <button onClick={handleGoBack} className="back-button">← Назад</button>
      <h2 className="chat-header">Chat with {decodedReceiverName}</h2>

      <div className="chat-messages">
        {messages.map((msg, index) => (
          <div key={index} className={`chat-message ${msg.senderId === currentUserId ? 'user' : 'other'}`}>
            {msg.senderId === currentUserId && (
              <div className="chat-actions">
                <button onClick={() => handleEdit(msg)}>✏️</button>
                <button onClick={() => handleDelete(msg.id)}>🗑️</button>
              </div>
            )}
            <div className="chat-content">
              {msg.content.startsWith('📎 Файл: ') ? (
                isImage(msg.content.replace('📎 Файл: ', '')) ? (
                  <img
                    src={msg.content.replace('📎 Файл: ', '')}
                    alt="uploaded"
                    className="chat-image"
                  />
                ) : (
                  <a
                    href={msg.content.replace('📎 Файл: ', '')}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    📎 Скачать файл
                  </a>
                )
              ) : (
                msg.content
              )}
            </div>
            {msg.createdAt && (
              <div className="chat-timestamp">
                {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="chat-input-container">
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type a message"
        />
        <FileUpload onUpload={(url) => {
          const msg = `📎 Файл: ${url}`;
          setMessage(msg);
        }} />
        <button onClick={handleSendMessage} disabled={!aesKey || !message.trim()}>
          Send
        </button>
      </div>
    </div>
  );
}
