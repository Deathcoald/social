// src/App.tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import ChatInit from './pages/ChatInit';
import ProfilePage from './pages/ProfilePages';
import ChatLayout from './pages/ChatLayout';
import Chat from './pages/Chat';

import "./App.css"

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Register />} />
        <Route path="/chat" element={<ChatLayout />}>
          <Route index element={<div className="empty-chat" ><h3>Выберите чат</h3></div>} />
          <Route path="init" element={<ChatInit />} />
          <Route path=":chatId" element={<Chat />} />
        </Route>
        <Route path="/profile/:userId" element={<ProfilePage />} />
      </Routes>
    </BrowserRouter>
  );
}
