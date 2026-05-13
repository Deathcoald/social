import { useState, useEffect} from "react";
import { useNavigate } from "react-router-dom";
import { Link } from 'react-router-dom';
import './side-bar.css'

type Chat = {
  id: number;
  name: string;
  is_group: boolean;
};

export default function Sidebar() {
  const [chats, setChats] = useState<Chat[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    fetch("http://localhost:8000/chats", {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
    })
      .then(res => res.json())
      .then(setChats);
  }, []);

  return (
    <div className="sidebar">
      <div className="chat-list">
        <h3>Chats</h3>

      {chats.map(chat => (
        <Link className="chat-items" key={chat.id} to={`/chat/${chat.id}`}>
          <div className="chat-item">
            {chat.name}
          </div>
        </Link>
      ))}
      </div>
      <div className="chat-init">
          <button onClick={() => navigate("/chat/init")}>
            Create Chat
          </button>
      </div>
    </div>
  );
}