import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import '../styles/ChatInit.css';
import { jwtDecode } from 'jwt-decode';

type ChatPreview = {
  user_id: number;
  username: string;
};

export default function ChatInit() {
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [existingChats, setExistingChats] = useState<ChatPreview[]>([]);
  const navigate = useNavigate();

  const getUserIdFromToken = (token: string): number | null => {
    try {
      const decoded = jwtDecode<{ user_id: number }>(token);
      return decoded.user_id;
    } catch {
      return null;
    }
  };

  const initiateChatWithUsername = async (usernameToUse: string) => {
    setError('');

    if (!usernameToUse) {
      setError("Введите имя пользователя");
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) {
      setError("Вы не авторизованы");
      return;
    }

    const currentUserId = getUserIdFromToken(token);
    if (!currentUserId) {
      setError("Невалидный токен");
      return;
    }

    try {
      const response = await fetch(`http://localhost:8000/chat/init/${usernameToUse}`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });

      if (!response.ok) {
        setError("Не удалось создать или получить чат");
        return;
      }

      const data = await response.json();
      const receiver_id = data.receiver_id;
      const user_id = data.sender_id;
      const receiver_name = data.receiver_username;

      if (receiver_id === currentUserId) {
        localStorage.setItem("chatAesKeyEncrypted", data.receiver_aes_key);
        navigate(`/chat/${user_id}/${encodeURIComponent(receiver_name)}`);
      } else {
        localStorage.setItem("chatAesKeyEncrypted", data.sender_aes_key);
        navigate(`/chat/${receiver_id}/${encodeURIComponent(receiver_name)}`);
      }

    } catch (err) {
      console.error("Ошибка при инициализации чата:", err);
      setError("Не удалось создать или получить чат");
    }
  };

  useEffect(() => {
    const fetchChats = async () => {
      const token = localStorage.getItem("token");
      if (!token) return;

      try {
        const response = await fetch(`http://localhost:8000/users/list`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (response.ok) {
          const data = await response.json();
          setExistingChats(data);
        } else {
          console.error("Ошибка при загрузке чатов");
        }
      } catch (err) {
        console.error("Ошибка сети:", err);
      }
    };

    fetchChats();
  }, []);

  const handleStartChat = () => {
    initiateChatWithUsername(username);
  };

  const handleSelectChat = (chat: ChatPreview) => {
    initiateChatWithUsername(chat.username);
  };

  return (
  <div className="chat-init-wrapper">
    <div className="chat-sidebar">
      <h3>Чаты</h3>
      {existingChats.length === 0 ? (
        <p className="empty">Нет активных чатов</p>
      ) : (
        <ul className="chat-list">
          {existingChats.map((chat) => (
            <li key={chat.user_id}>
              <button
                className="chat-list-button"
                onClick={() => handleSelectChat(chat)}
              >
                💬 {chat.username}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>

    <div className="chat-main">
      <h2>Новый чат</h2>
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
