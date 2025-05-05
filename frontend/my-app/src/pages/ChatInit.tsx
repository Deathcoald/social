import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function ChatInit() {
  const [receiverId, setReceiverId] = useState('');
  const navigate = useNavigate();

  const handleStartChat = async () => {
    if (!receiverId) {
      alert("Please enter a receiver ID");
      return;
    }

    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`http://localhost:8000/chat/init/${receiverId}`, 
      {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });

      if (!response.ok) {
        console.error("Ошибка при инициализации чата");
        alert("Не удалось создать или получить чат");
        return;
      }

      const data = await response.json();
      console.log("AES ключи:", data);

      localStorage.setItem("chatAesKeyEncrypted", data.sender_aes_key); 
      localStorage.setItem("chatAesKeyForReceiver", data.receiver_aes_key);

      console.log(localStorage.getItem("chatAesKeyEncrypted"))
      console.log(localStorage.getItem("chatAesKeyForReceiver"))

      console.log("Чат инициализирован, ключи получены");

      
        navigate(`/chat/${receiverId}`);
      }
     catch (err) {
      console.error("Ошибка при инициализации чата:", err);
      alert("Не удалось создать или получить чат");
    }
  };

  return (
    <div>
      <h2>Chat Initialization</h2>
      <input
        type="text"
        placeholder="Enter Receiver ID"
        value={receiverId}
        onChange={(e) => setReceiverId(e.target.value)}
      />
      <button onClick={handleStartChat}>Start Chat</button>
    </div>
  );
}
