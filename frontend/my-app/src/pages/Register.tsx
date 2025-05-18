// src/pages/Register.tsx
import { useState } from 'react';
import { register } from '../api/auth';
import { useNavigate, Link } from 'react-router-dom';
import eye from '../assets/eye.svg';
import eyeSlash from '../assets/eye-solid.svg';
import '../styles/Register.css';

export default function Register() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleRegister = async () => {
    setError('');

    if (!username || !password) {
      setError('Введите username и пароль');
      return;
    }

    try {
      await register(username, password);
      navigate('/login');
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <div className="register-container">
      <div className="register-box">
        <h2>Регистрация</h2>
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
        {error && <p className="register-error">{error}</p>}
        <button onClick={handleRegister}>Зарегистрироваться</button>
        <p className="login-link">
          <Link to="/login">Уже зарегистрированы? Войти</Link>
        </p>
      </div>
    </div>
  );
}
