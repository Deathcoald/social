// src/pages/Register.tsx
import { useState } from 'react';
import { register } from '../api/auth';
import { useNavigate } from 'react-router-dom';

export default function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const handleRegister = async () => {
    try {
      console.log("Trying to register:", email, password);
      await register(email, password);
      console.log("Registration successful");
      navigate('/chat-init'); 
    } catch (e) {
      console.error("Registration failed", e);
      alert('Error');
    }
  };
  

  return (
    <div>
      <input placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
      <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />
      <button onClick={handleRegister}>Register</button>
    </div>
  );
}
