import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { jwtDecode } from "jwt-decode";
import { JwtPayload } from 'jwt-decode';
import {
  aesEncrypt,
  aesDecrypt,
  decryptAesKeyWithRsa,
} from '../crypto/aes';

type ChatMessage = {
  senderId: number;
  content: string;
};

export default function Chat() {
  const { receiverId } = useParams();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [message, setMessage] = useState('');
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [aesKey, setAesKey] = useState<CryptoKey | null>(null);

  
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
      const privateKeyPem = localStorage.getItem("encryptionPrivateKey");

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
    if (!token || !receiverId || !aesKey) return;

    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const socket = new WebSocket(`${protocol}://localhost:8000/ws/chat?token=${token}`);

    socket.onopen = () => {
      console.log("✅ WebSocket открыт");
      setWs(socket);
    };

    socket.onmessage = async (event) => {
      const data = JSON.parse(event.data);
      console.log("📩 Получено сообщение:", data);

      if (data.content && aesKey) {
        try {
          const decryptedMessage = await aesDecrypt(data.content, aesKey);
          setMessages((prev) => [...prev, {
            senderId: data.sender_id,
            content: decryptedMessage,
          }]);
        } catch (error) {
          console.error("Ошибка при расшифровке сообщения:", error);
        }
      }
    };

    socket.onclose = () => {
      console.log("❌ WebSocket закрыт");
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
        senderId: currentUserId ?? 0,
        content: message,
      }]);

      setMessage('');
    } catch (error) {
      console.error("Ошибка при отправке сообщения:", error);
    }
  };

  return (
    <div>
      <h2>Chat with {receiverId}</h2>

      <div
        style={{
          height: '400px',
          overflowY: 'auto',
          border: '1px solid #ccc',
          padding: '10px',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {messages.map((msg, index) => (
          <div
            key={index}
            style={{
              background: msg.senderId === currentUserId ? '#d1ffd1' : '#f1f1f1',
              alignSelf: msg.senderId === currentUserId ? 'flex-end' : 'flex-start',
              padding: '8px',
              margin: '5px 0',
              borderRadius: '6px',
              maxWidth: '70%',
              wordWrap: 'break-word',
            }}
          >
            {msg.content}
          </div>
        ))}
      </div>

      <input
        type="text"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Type a message"
        style={{ width: '80%', marginRight: '10px' }}
      />
      <button onClick={handleSendMessage} disabled={!aesKey || !message.trim()}>
        Send
      </button>
    </div>
  );
}
