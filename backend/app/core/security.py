from datetime import datetime, timedelta, timezone
from typing import Any, Union
import hashlib
from jose import jwt
from passlib.context import CryptContext
from .config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def create_access_token(
    subject: Union[str, Any], expires_delta: timedelta = None
) -> str:
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(
            minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
        )
    to_encode = {"exp": expire, "sub": str(subject)}
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def validate_password(password: str) -> None:
    """Raise a safe validation error when a credential is too weak."""
    if len(password.encode("utf-8")) > 72:
        raise ValueError("Password must be 72 bytes or fewer")
    if len(password) < 8 or not any(char.isupper() for char in password) or not any(char.islower() for char in password) or not any(char.isdigit() for char in password):
        raise ValueError("Password must be at least 8 characters and include upper-case, lower-case, and a number")


def hash_otp(email: str, otp: str) -> str:
    """Store only a keyed digest of a verification code, never the raw OTP."""
    payload = f"{email.lower()}:{otp}:{settings.SECRET_KEY}".encode("utf-8")
    return hashlib.sha256(payload).hexdigest()
