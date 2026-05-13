import Sidebar from '../component/Sidebar'
import { Outlet } from 'react-router-dom';
import '../styles/ChatLayout.css'
import ChatInit from "./ChatInit";

export default function ChatLayout() {
  return (
    <div className="chat-layout">
        <div className="chat-sidebar">
            <Sidebar />
        </div>
      <div className="chat-main">
        <Outlet />
      </div>
    </div>
  );
}