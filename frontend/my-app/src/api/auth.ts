// Файл: src/api/auth.ts
import axios from 'axios';
import { encryptPrivateKeyWithPassword } from '../crypto/rsa';
import { decryptPrivateKeyWithPassword } from '../crypto/rsa';

const API_URL = 'http://localhost:8000';

export const login = async (username: string, password: string) => {
  const res = await axios.post(
    `${API_URL}/login`,
    new URLSearchParams({
      username: username,
      password: password,
    }),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );
  
  const token = res.data.access_token;
  localStorage.setItem('token', token);
  sessionStorage.setItem("currentUsername", username);

  const userRes = await axios.get(`${API_URL}/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const EncryptedPrivateKey = userRes.data.private_key;

  localStorage.setItem('EncryptedPrivateKey', EncryptedPrivateKey)

  const privateKey = await decryptPrivateKeyWithPassword(EncryptedPrivateKey, password);

  sessionStorage.setItem('decryptedPrivateKey', privateKey);
};



export const getCurrentUser = async () => {
  const token = localStorage.getItem('token');
  const res = await axios.get(`${API_URL}/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
};


export const register = async (username: string, password: string) => {
  const { generateEncryptionKeys } = await import('../crypto/rsa');

  const { encryptionPublicKey, encryptionPrivateKey } = await generateEncryptionKeys();

  if (!username || username.length < 3) {
    throw new Error('Имя пользователя должно содержать минимум 3 символа.');
  }

  if (!password || password.length < 8) {
    throw new Error('Пароль должен содержать минимум 8 символов.');
  }

  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /\d/.test(password);

  if (!hasLetter || !hasNumber) {
    throw new Error('Пароль должен содержать хотя бы одну букву и одну цифру.');
  }

  const encryptedPrivateKey = await encryptPrivateKeyWithPassword(encryptionPrivateKey, password);

  const res = await axios.post(`${API_URL}/users/`, {
    username,
    password,
    public_key: encryptionPublicKey,
    private_key: encryptedPrivateKey,
  });

  return res.data;
};

export {};


