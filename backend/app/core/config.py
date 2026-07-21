from typing import Optional
from pathlib import Path
from pydantic_settings import BaseSettings


BACKEND_DIR = Path(__file__).resolve().parents[2]
REPO_ROOT = BACKEND_DIR.parent

class Settings(BaseSettings):
    DATABASE_URL: str
    SECRET_KEY: str
    ALGORITHM: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    OTP_RESEND_COOLDOWN_SECONDS: int = 60
    OTP_MAX_ATTEMPTS: int = 5
    SUPER_ADMIN_LOCKOUT_SECONDS: int = 300
    SUPER_ADMIN_MAX_ATTEMPTS: int = 5
    # Optional in hosted deployments: the API derives the same-site OTP route.
    OTP_SERVICE_URL: Optional[str] = None
    SUPER_ADMIN_PIN: str
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    SMTP_HOST: Optional[str] = "smtp.gmail.com"
    SMTP_PORT: Optional[int] = 587
    OPENROUTER_API_KEY: Optional[str] = None
    OPENROUTER_MODEL: Optional[str] = "google/gemma-4-26b-a4b-it:free"

    class Config:
        env_file = (BACKEND_DIR / ".env", REPO_ROOT / ".env")
        env_file_encoding = "utf-8"

settings = Settings()
