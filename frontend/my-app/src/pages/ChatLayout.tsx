import Sidebar from '../component/Sidebar'
import { Outlet } from 'react-router-dom';
import {useState, useEffect} from "react";
import '../styles/ChatLayout.css'

type Chat = {
  id: number;
  name: string;
  is_group: boolean;
};

export default function ChatLayout() {
    const [chats, setChats] = useState<Chat[]>([]);

    const fetchChats = async () => {
        try {
          const res = await fetch("http://localhost:8000/chats", {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
          });

          const data = await res.json();
          setChats(data);
        } catch (err) {
          console.error(err);
        }
    };

    useEffect(() => {
    fetchChats();
    }, []);
  return (
    <div className="chat-layout">
        <div className="chat-sidebar">
            <Sidebar chats={chats} />
        </div>
      <div className="chat-main">
        <Outlet context={{ fetchChats }} />
      </div>
    </div>
  );
}