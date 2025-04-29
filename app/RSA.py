from cryptography.hazmat.primitives.asymmetric import rsa, padding, utils
from cryptography.hazmat.primitives import serialization, hashes


def load_public_key(pem_str: str):
    return serialization.load_pem_public_key(pem_str.encode())

def load_private_key(pem_str: str, password: str):
    return serialization.load_pem_private_key(pem_str.encode(), password=password.encode())

def generate_keys(password: str):
    private_key = rsa.generate_private_key(public_exponent=65537,key_size=2048,)
    public_key = private_key.public_key()

    pem_private = private_key.private_bytes(
    encoding=serialization.Encoding.PEM,
    format=serialization.PrivateFormat.PKCS8,
    encryption_algorithm=serialization.BestAvailableEncryption(password.encode())).decode()

    pem_public = public_key.public_bytes(
    encoding=serialization.Encoding.PEM,
    format=serialization.PublicFormat.SubjectPublicKeyInfo).decode()

    return pem_private, pem_public

def create_sign(private_key, password, message: bytes):
    private_key = load_private_key(private_key, password)

    content_hash = hashes.Hash(hashes.SHA256())
    content_hash.update(message)
    message_hash = content_hash.finalize()

    signature = private_key.sign(
    message_hash,
    padding.PSS(
        mgf=padding.MGF1(hashes.SHA256()),
        salt_length=padding.PSS.MAX_LENGTH
    ),
    hashes.SHA256())

    return signature

def verify_singature(public_key, signature, message: bytes):
    public_key = load_public_key(public_key)

    content_hash = hashes.Hash(hashes.SHA256())
    content_hash.update(message)
    message_hash = content_hash.finalize()

    public_key.verify(
    signature,
    message_hash,
    padding.PSS(
        mgf=padding.MGF1(hashes.SHA256()),
        salt_length=padding.PSS.MAX_LENGTH
    ),
    hashes.SHA256())

def encryp_message(public_key, message): 
    public_key = load_public_key(public_key)
    ciphertext = public_key.encrypt(message,
        padding.OAEP(
        mgf=padding.MGF1(algorithm=hashes.SHA256()),
        algorithm=hashes.SHA256(),
        label=None
    ))
    return ciphertext

def decrypt_message(private_key, password, ciphertext):
    private_key = load_private_key(private_key, password)

    plaintext = private_key.decrypt(
    ciphertext,
    padding.OAEP(
        mgf=padding.MGF1(algorithm=hashes.SHA256()),
        algorithm=hashes.SHA256(),
        label=None
    ))
    print(plaintext)
    return plaintext