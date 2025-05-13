// Файл: src/api/auth.ts
import axios from 'axios';

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
  console.log('token', res.data.access_token)
  
  localStorage.setItem('token', res.data.access_token);
  sessionStorage.setItem("currentUsername", username);
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

  console.log("Sending registration data:", {
    username,
    password,
    encryption_public_key: encryptionPublicKey,
  });

  const res = await axios.post(`${API_URL}/users/`, {
    username,
    password,
    public_key: encryptionPublicKey,
  });

  console.log("Server response:", res.data);

   localStorage.setItem(`encrypyionPrivateKey-${username}`, encryptionPrivateKey);

  return res.data;
};

export {};


