// src/pages/Login.tsx
import { useState } from 'react';
import { login } from '../api/auth';
import { useNavigate } from 'react-router-dom';
import eye from '../assets/eye.svg';
import eyeSlash from '../assets/eye-solid.svg';
import '../styles/Login.css';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
   const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async () => {
    setError('');

    if (!username || !password) {
      setError('Введите username и пароль');
      return;
    }

    try {
      await login(username, password);
      navigate('/chat-init');
    } catch (e) {
      console.log(e)
      setError('Неверный username или пароль');
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <h2>Вход</h2>
        <input
          placeholder="Username"
          value={username}
          onChange={e => setUsername(e.target.value)}
        />
        <div className="password-wrapper">
        <input
          type={showPassword ? "text" : "password"}
          placeholder="Пароль"
          value={password}
          onChange={e => setPassword(e.target.value)}
        />
        <span className="toggle-password" onClick={() => setShowPassword(prev => !prev)}>
          <img
            src={showPassword ? eyeSlash : eye}
            alt="toggle visibility"
            className="eye-icon"
          />
        </span>
        </div>
        {error && <p className="login-error">{error}</p>}
        <button onClick={handleLogin}>Войти</button>
      </div>
    </div>
  );
}
