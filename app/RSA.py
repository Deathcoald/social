from cryptography.hazmat.primitives import serialization, hashes


def load_public_key(pem_str: str):
    return serialization.load_pem_public_key(pem_str.encode())