from typing import Optional
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str
    SECRET_KEY: str
    ALGORITHM: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int
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
        env_file = ".env"

settings = Settings()
