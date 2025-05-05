import os

from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.primitives.asymmetric import rsa, padding
from cryptography.hazmat.primitives import serialization, hashes
from cryptography.hazmat.backends import default_backend

from . import RSA, models

def load_public_key(pem_str: str):
    return serialization.load_pem_public_key(pem_str.encode())

def generate_aes_key():
    return os.urandom(32) 

def encrypt_aes_key_with_rsa(public_key_pem, aes_key):
    public_key = load_public_key(public_key_pem)
    encrypted_aes_key = public_key.encrypt(
        aes_key,
        padding.OAEP(
            mgf=padding.MGF1(algorithm=hashes.SHA256()),
            algorithm=hashes.SHA256(),
            label=None
        )
    )
    return encrypted_aes_key

