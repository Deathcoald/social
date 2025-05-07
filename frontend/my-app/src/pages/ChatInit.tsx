import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import '../styles/ChatInit.css';
import { jwtDecode } from 'jwt-decode';

export default function ChatInit() {
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const getUserIdFromToken = (token: string): number | null => {
    try {
      const decoded = jwtDecode<{ user_id: number }>(token);
      return decoded.user_id;
    } catch {
      return null;
    }
  };

  const handleStartChat = async () => {
    setError('');

    if (!username) {
      setError("Введите имя пользователя или email");
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) {
      setError("Вы не авторизованы");
      return;
    }

    try {
      const response = await fetch(`http://localhost:8000/chat/init/${username+"@gmail.com"}`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });

      if (!response.ok) {
        console.error("Ошибка при инициализации чата");
        setError("Не удалось создать или получить чат");
        return;
      }

      const data = await response.json();

      const receiver_id = data.receiver_id;
      const receiver_name = data.receiver_username;

      localStorage.setItem("chatAesKeyEncrypted", data.sender_aes_key);
      localStorage.setItem("chatAesKeyForReceiver", data.receiver_aes_key);

      navigate(`/chat/${receiver_id}/${encodeURIComponent(receiver_name)}`);

    } catch (err) {
      console.error("Ошибка при инициализации чата:", err);
      setError("Не удалось создать или получить чат");
    }
  };

  return (
    <div className="chat-init-container">
      <div className="chat-init-box">
        <h2>Начать чат</h2>
        <input
          type="text"
          placeholder="Введите имя пользователя"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        {error && <p className="chat-init-error">{error}</p>}
        <button onClick={handleStartChat}>Начать</button>
        <p className="back-link">
          <Link to="/login">← Назад к входу</Link>
        </p>
      </div>
    </div>
  );
}
