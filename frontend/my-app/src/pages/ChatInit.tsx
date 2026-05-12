import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import "../styles/ChatInit.css";

type ChatPreview = {
  id: number;
  name: string;
  is_group: boolean;
};

type UserPreview = {
  id: number;
  username: string;
};

export default function ChatInit() {
  const navigate = useNavigate();

  const [users, setUsers] = useState<UserPreview[]>([]);
  const [chats, setChats] = useState<ChatPreview[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
  const [groupName, setGroupName] = useState("");
  const [isGroup, setIsGroup] = useState(false);
  const [error, setError] = useState("");

  const token = localStorage.getItem("token");

  useEffect(() => {
    fetchUsers();
    fetchChats();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await fetch("http://localhost:8000/users/list", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();
      setUsers(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchChats = async () => {
    try {
      const response = await fetch("http://localhost:8000/chats", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();
      setChats(data);
    } catch (err) {
      console.error(err);
    }
  };

  const toggleUser = (id: number) => {
    setSelectedUsers((prev) =>
      prev.includes(id)
        ? prev.filter((u) => u !== id)
        : [...prev, id]
    );
  };

  const createChat = async () => {
    setError("");

    if (selectedUsers.length === 0) {
      setError("Выберите пользователей");
      return;
    }

    if (!isGroup && selectedUsers.length > 1) {
      setError("DM чат может иметь только 1 пользователя");
      return;
    }

    try {
      const response = await fetch("http://localhost:8000/chat/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          type: isGroup ? "GROUP" : "DM",
          members: selectedUsers,
          name: isGroup ? groupName : null,
        }),
      });

      if (!response.ok) {
        setError("Ошибка создания чата");
        return;
      }

      const data = await response.json();

      navigate(`/chat/${data.chat_id}`);
    } catch (err) {
      console.error(err);
      setError("Ошибка сети");
    }
  };

  return (
    <div className="chat-init-wrapper">

      <div className="chat-sidebar">
        <h3>Чаты</h3>

        {chats.map((chat) => (
          <button
            key={chat.id}
            className="chat-list-button"
            onClick={() => navigate(`/chat/${chat.id}`)}
          >
            {chat.is_group ? "👥" : "💬"} {chat.name}
          </button>
        ))}
      </div>

      <div className="chat-main">

        <h2>Создать чат</h2>

        <div className="chat-type-selector">
          <button onClick={() => setIsGroup(false)}>
            DM
          </button>

          <button onClick={() => setIsGroup(true)}>
            GROUP
          </button>
        </div>

        {isGroup && (
          <input
            type="text"
            placeholder="Название группы"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
          />
        )}

        <div className="users-list">
          {users.map((user) => (
            <button
              key={user.id}
              className={`user-button ${
                selectedUsers.includes(user.id)
                  ? "selected"
                  : ""
              }`}
              onClick={() => toggleUser(user.id)}
            >
              {user.username}
            </button>
          ))}
        </div>

        {error && (
          <p className="chat-init-error">
            {error}
          </p>
        )}

        <button onClick={createChat}>
          Создать чат
        </button>

        <p className="back-link">
          <Link to="/login">
            ← Назад
          </Link>
        </p>

      </div>
    </div>
  );
}