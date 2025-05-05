// src/App.tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import ChatInit from './pages/ChatInit';
import Chat from './pages/Chat'; 

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/chat-init" element={<ChatInit />} />
        <Route path="/chat/:receiverId" element={<Chat />} /> {/* Добавляем новый маршрут для чата */}
      </Routes>
    </BrowserRouter>
  );
}
