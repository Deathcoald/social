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

  useEffect(() => {
    const initChat = async () => {
      const encryptedSenderKeyBase64 = localStorage.getItem("chatAesKeyEncrypted");
      const username = sessionStorage.getItem("currentUsername");
      const privateKeyPem = localStorage.getItem(`encrypyionPrivateKey-${username}`);
      
      console.log(encryptedSenderKeyBase64)
      console.log(privateKeyPem)

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
      if (!token || !receiverId || !aesKey) return;

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
      console.log("Получено сообщение:", data);

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

      const msg = {
        content: encryptedMessage,
        receiver_id: receiverId,
      };

      ws.send(JSON.stringify(msg));
      setMessages((prev) => [...prev, {
        id: Date.now(),
        senderId: currentUserId ?? 0,
        content: message,
      }]);

      setMessage('');
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
  } catch (err) {
    console.error("Ошибка при удалении:", err);
  }
};

const handleEdit = async (msg: ChatMessage) => {
  const newText = prompt("Новое сообщение:", msg.content);
  if (!newText) 
    return;

   if (!aesKey) {
    console.error("AES ключ не готов");
    return;
  }

  try {
    const encrypted = await aesEncrypt(aesKey, newText); 

    await fetch(`http://localhost:8000/chat/messages/${msg.id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ content: encrypted }),
    });

    setMessages((prev) =>
      prev.map((m) => (m.id === msg.id ? { ...m, content: newText } : m)) 
    );
  } catch (err) {
    console.error("Ошибка при редактировании:", err);
  }
};

  return (
    <div className="chat-container">
      <h2 className="chat-header">Chat with {decodedReceiverName}</h2>

      <button
        onClick={() => navigate(`/profile/${receiverId}`)}
        className="chat-profile-button"
      >
        Открыть профиль
      </button>

      <div className="chat-messages">
        {messages.map((msg, index) => (
  <div
    key={index}
    className={`chat-message ${msg.senderId === currentUserId ? 'user' : 'other'}`}
  >
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
