import os

from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.primitives.asymmetric import rsa, padding
from cryptography.hazmat.primitives import serialization, hashes
from cryptography.hazmat.backends import default_backend

from . import RSA, models


def generate_aes_key():
    return os.urandom(32) 

def encrypt_aes_key_with_rsa(public_key_pem, aes_key):
    public_key = RSA.load_public_key(public_key_pem)
    encrypted_aes_key = public_key.encrypt(
        aes_key,
        padding.OAEP(
            mgf=padding.MGF1(algorithm=hashes.SHA256()),
            algorithm=hashes.SHA256(),
            label=None
        )
    )
    return encrypted_aes_key

def encrypt_message_with_aes(aes_key, message):
    iv = os.urandom(16)  
    cipher = Cipher(algorithms.AES(aes_key), modes.CBC(iv), backend=default_backend())
    encryptor = cipher.encryptor()
    print("kashira")

    padding_length = 16 - len(message) % 16
    padded_message = message + chr(padding_length) * padding_length
    encrypted_message = encryptor.update(padded_message.encode()) + encryptor.finalize()
    
    return iv + encrypted_message

def decrypt_aes_key_with_rsa(private_key_pem, password, encrypted_aes_key):
    private_key = RSA.load_private_key(private_key_pem, password)
    aes_key = private_key.decrypt(
        encrypted_aes_key,
        padding.OAEP(
            mgf=padding.MGF1(algorithm=hashes.SHA256()),
            algorithm=hashes.SHA256(),
            label=None
        )
    )
    return aes_key

def decrypt_message_with_aes(aes_key, encrypted_message):
    iv = encrypted_message[:16] 
    encrypted_message_data = encrypted_message[16:]
    print(encrypted_message)

    cipher = Cipher(algorithms.AES(aes_key), modes.CBC(iv), backend=default_backend())
    decryptor = cipher.decryptor()
    decrypted_message = decryptor.update(encrypted_message_data) + decryptor.finalize()
    print(decrypted_message)

    padding_length = decrypted_message[-1]

    if isinstance(padding_length, str):  
        padding_length = ord(padding_length)
        
    return decrypted_message[:-padding_length]

