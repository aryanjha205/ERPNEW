from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from app.core.config import settings
from app.core.security import create_access_token

router = APIRouter()

class SuperAdminLogin(BaseModel):
    pin: str

@router.post("/super-admin/login")
def super_admin_login(data: SuperAdminLogin):
    if data.pin == settings.SUPER_ADMIN_PIN:
        access_token = create_access_token(subject="super-admin")
        return {"access_token": access_token, "token_type": "bearer", "role": "super_admin"}
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid Super Admin PIN",
    )
