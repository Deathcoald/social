// src/components/FileUpload.tsx
import React, { useRef } from 'react';

type Props = {
  onUpload: (url: string) => void;
};

export default function FileUpload({ onUpload }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('http://localhost:8000/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const data = await response.json();
      onUpload(data.url); 
    } catch (err) {
      console.error('Ошибка загрузки файла:', err);
      alert('Ошибка при загрузке файла');
    }
  };

  return (
    <div>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />
      <button onClick={() => fileInputRef.current?.click()}>📎</button>
    </div>
  );
}
