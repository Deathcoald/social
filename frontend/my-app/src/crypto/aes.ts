const { subtle } = globalThis.crypto;


const exportAesKey = async (key: CryptoKey): Promise<ArrayBuffer> => {
  return await subtle.exportKey('raw', key); 
};

function pemToBase64(pem: string): string {
  return pem
    .replace(/-----BEGIN [\w ]+-----/, '')
    .replace(/-----END [\w ]+-----/, '')
    .replace(/\s/g, '');
}

const importRsaPrivateKey = async (pem: string): Promise<CryptoKey> => {
  const base64 = pemToBase64(pem);
  const binaryDer = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  return await subtle.importKey(
    'pkcs8',
    binaryDer.buffer,
    {
      name: 'RSA-OAEP',
      hash: 'SHA-256',
    },
    false,
    ['decrypt']
  );
};

const importRsaPublicKey = async (pem: string): Promise<CryptoKey> => {
  const base64 = pemToBase64(pem);
  const binaryDer = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  return await subtle.importKey(
    'spki',
    binaryDer.buffer,
    {
      name: 'RSA-OAEP',
      hash: 'SHA-256',
    },
    false,
    ['encrypt']
  );
};



const encryptAesKeyWithRsa = async (aesKey: CryptoKey, rsaPublicKeyBase64: string): Promise<string> => {
  const rawAesKey = await exportAesKey(aesKey);
  const rsaPublicKey = await importRsaPublicKey(rsaPublicKeyBase64);

  const encrypted = await subtle.encrypt(
    { name: 'RSA-OAEP' },
    rsaPublicKey,
    rawAesKey
  );

  return btoa(String.fromCharCode(...new Uint8Array(encrypted))); 
};

const decryptAesKeyWithRsa = async (
  encryptedAesKeyBase64: string,
  rsaPrivateKeyBase64: string
): Promise<CryptoKey> => {
  const encryptedAesKey = Uint8Array.from(atob(encryptedAesKeyBase64), (c) => c.charCodeAt(0));
  const rsaPrivateKey = await importRsaPrivateKey(rsaPrivateKeyBase64);
  console.log("encryptedAesKey:", encryptedAesKey);
  console.log("rsaPrivateKey:", rsaPrivateKey);

  const rawAesKey = await subtle.decrypt(
    { name: 'RSA-OAEP' },
    rsaPrivateKey,
    encryptedAesKey
  );
  console.log("kashira")
  return await subtle.importKey(
    'raw',
    rawAesKey,
    { name: 'AES-CBC' },
    true,
    ['encrypt', 'decrypt']
  );
};


async function aesEncrypt(aesKey: CryptoKey, plaintext: string): Promise<string> {
  const encoder = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(16));

  const textBytes = encoder.encode(plaintext);
  const paddingLength = 16 - (textBytes.length % 16);
  const padded = new Uint8Array(textBytes.length + paddingLength);
  padded.set(textBytes);
  padded.fill(paddingLength, textBytes.length); 

  const ciphertext = await subtle.encrypt(
    {
      name: 'AES-CBC',
      iv,
    },
    aesKey,
    padded
  );

  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(ciphertext), iv.length);
  
  return btoa(String.fromCharCode(...combined));
}


async function aesDecrypt(base64: string, aesKey: CryptoKey): Promise<string> {
  const data = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
  const iv = data.slice(0, 16);
  const ciphertext = data.slice(16);

  const decrypted = await subtle.decrypt(
    {
      name: 'AES-CBC',
      iv,
    },
    aesKey,
    ciphertext
  );

  const decryptedBytes = new Uint8Array(decrypted);
  const paddingLength = decryptedBytes[decryptedBytes.length - 1];
  const unpadded = decryptedBytes.slice(0, -paddingLength);

  return new TextDecoder().decode(unpadded);
}

export {aesEncrypt, encryptAesKeyWithRsa, decryptAesKeyWithRsa, aesDecrypt};