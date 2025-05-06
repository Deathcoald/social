// src/pages/Register.tsx
import { useState } from 'react';
import { register } from '../api/auth';
import { useNavigate, Link } from 'react-router-dom';
import '../styles/Register.css';

export default function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleRegister = async () => {
    setError('');

    if (!email || !password) {
      setError('Введите email и пароль');
      return;
    }

    try {
      await register(email, password);
      navigate('/login');
    } catch (e) {
      setError('Ошибка регистрации. Возможно, пользователь уже существует.');
    }
  };

  return (
    <div className="register-container">
      <div className="register-box">
        <h2>Регистрация</h2>
        <input
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
        />
        <input
          type="password"
          placeholder="Пароль"
          value={password}
          onChange={e => setPassword(e.target.value)}
        />
        {error && <p className="register-error">{error}</p>}
        <button onClick={handleRegister}>Зарегистрироваться</button>
        <p className="login-link">
          <Link to="/login">Уже зарегистрированы? Войти</Link>
        </p>
      </div>
    </div>
  );
}
