const { subtle } = globalThis.crypto;

export const generateEncryptionKeys = async () => {

  const encryptionKeyPair = await subtle.generateKey(
    {
      name: 'RSA-OAEP',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['encrypt', 'decrypt'] 
  );

  const wrapPEM = (base64: string, type: 'PUBLIC KEY' | 'PRIVATE KEY') => {
    const lines = base64.match(/.{1,64}/g)?.join('\n');
    return `-----BEGIN ${type}-----\n${lines}\n-----END ${type}-----\n`;
  };
  
  const exportKey = async (key: CryptoKey, type: 'spki' | 'pkcs8') => {
    const exported = await subtle.exportKey(type, key);
    const base64 = btoa(String.fromCharCode(...new Uint8Array(exported)));
    return type === 'spki'
      ? wrapPEM(base64, 'PUBLIC KEY')
      : wrapPEM(base64, 'PRIVATE KEY');
  };

  return {
    encryptionPublicKey: await exportKey(encryptionKeyPair.publicKey, 'spki'),
    encryptionPrivateKey: await exportKey(encryptionKeyPair.privateKey, 'pkcs8'),
  };
};

export async function encryptPrivateKeyWithPassword(pem: string, password: string): Promise<string> {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(16));
  
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );
  
  const aesKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-CBC', length: 256 },
    false,
    ['encrypt']
  );

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-CBC', iv },
    aesKey,
    encoder.encode(pem)
  );

  const combined = new Uint8Array([...salt, ...iv, ...new Uint8Array(encrypted)]);
  return btoa(String.fromCharCode(...combined));
}

export async function decryptPrivateKeyWithPassword(encryptedBase64: string, password: string): Promise<string> {
  const data = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));
  const salt = data.slice(0, 16);
  const iv = data.slice(16, 32);
  const encrypted = data.slice(32);

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  const aesKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-CBC', length: 256 },
    false,
    ['decrypt']
  );

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-CBC', iv },
    aesKey,
    encrypted
  );

  return new TextDecoder().decode(decrypted);
}