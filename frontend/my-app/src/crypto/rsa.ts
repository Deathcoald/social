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
