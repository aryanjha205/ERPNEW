from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from app.core.config import settings

router = APIRouter()

class SuperAdminLogin(BaseModel):
    pin: str

@router.post("/super-admin/login")
def super_admin_login(data: SuperAdminLogin):
    if data.pin == settings.SUPER_ADMIN_PIN:
        # Generate JWT Token (To be implemented securely)
        return {"access_token": "super-admin-token-placeholder", "token_type": "bearer"}
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid Super Admin PIN",
    )
