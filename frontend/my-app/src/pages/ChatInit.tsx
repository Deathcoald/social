import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import "../styles/InitialChat.css";

type UserPreview = {
  id: number;
  username: string;
};

export default function ChatInit() {
  const navigate = useNavigate();

  const [users, setUsers] = useState<UserPreview[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
  const [groupName, setGroupName] = useState("");
  const [isGroup, setIsGroup] = useState(false);
  const [error, setError] = useState("");

  const token = localStorage.getItem("token");

  useEffect(() => {
    fetchUsers();
  }, []);

  const toggleMode = (mode: boolean) => {
  setIsGroup(mode);
  setError("");

  if (!mode && selectedUsers.length > 1) {
    setSelectedUsers([selectedUsers[0]]);
  }
};

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

  const toggleUser = (id: number) => {
    setSelectedUsers(prev =>
      prev.includes(id)
        ? prev.filter(u => u !== id)
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
      <div className="chat-init-container">

        <h2>Создать чат</h2>

            <div className="chat-init-type-selector">
      <button
        className={!isGroup ? "active" : ""}
        onClick={() => toggleMode(false)}
      >
        DM
      </button>

      <button
        className={isGroup ? "active" : ""}
        onClick={() => toggleMode(true)}
      >
        GROUP
      </button>
    </div>

        {isGroup && (
          <input
            className="chat-init-input"
            type="text"
            placeholder="Название группы"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
          />
        )}

        <div className="chat-init-users-list">
          {users.map(user => (
            <button
              key={user.id}
              className={`chat-init-user-button ${
                selectedUsers.includes(user.id) ? "selected" : ""
              }`}
              onClick={() => toggleUser(user.id)}
            >
              {user.username}
            </button>
          ))}
        </div>

        {error && <p className="chat-init-error">{error}</p>}

        <button
          className="chat-init-create-button"
          onClick={createChat}
        >
          Создать чат
        </button>

        <p className="chat-init-back-link">
          <Link className="chat-init-back-link-button" to="/login">← Назад</Link>
        </p>
      </div>
    </div>
  );
}