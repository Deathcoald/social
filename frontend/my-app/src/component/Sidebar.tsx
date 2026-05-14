import { useState, useEffect} from "react";
import { useNavigate } from "react-router-dom";
import { Link } from 'react-router-dom';
import './side-bar.css'

type Chat = {
  id: number;
  name: string;
  is_group: boolean;
};

type Props = {
  chats: Chat[];
};

export default function Sidebar({ chats }: Props) {
  const navigate = useNavigate();


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
        <div className="chat-init-button-container">
            <div className="chat-init">
                <button onClick={() => navigate("/chat/init")}>
                    Create Chat
                </button>
            </div>
        </div>
    </div>
  );
}