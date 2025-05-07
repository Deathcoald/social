// src/App.tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import ChatInit from './pages/ChatInit';
import Chat from './pages/Chat'; 
import ProfilePage from './pages/ProfilePages';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Register />} />
        <Route path="/chat-init" element={<ChatInit />} />
        <Route path="/chat/:receiverId/:receiverName" element={<Chat />} />
        <Route path="/profile/:userId" element={<ProfilePage />} />
      </Routes>
    </BrowserRouter>
  );
}
