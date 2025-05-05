// Файл: src/api/auth.ts
import axios from 'axios';

const API_URL = 'http://localhost:8000';

export const login = async (email: string, password: string) => {
  const res = await axios.post(
    `${API_URL}/login`,
    new URLSearchParams({
      username: email,
      password: password,
    }),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );
  console.log('token', res.data.access_token)
  localStorage.setItem('token', res.data.access_token);
};


export const getCurrentUser = async () => {
  const token = localStorage.getItem('token');
  const res = await axios.get(`${API_URL}/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
};


export const register = async (email: string, password: string) => {
  const { generateEncryptionKeys } = await import('../crypto/rsa');

  const { encryptionPublicKey, encryptionPrivateKey } = await generateEncryptionKeys();

  console.log("Sending registration data:", {
    email,
    password,
    encryption_public_key: encryptionPublicKey,
  });

  const res = await axios.post(`${API_URL}/users/`, {
    email,
    password,
    public_key: encryptionPublicKey,
  });

  console.log("Server response:", res.data);

  localStorage.setItem('encryptionPrivateKey', encryptionPrivateKey);

  return res.data;
};

export {};


