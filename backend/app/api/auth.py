"""
Authentication API — Super Admin PIN, Company Admin, Employee Login.
"""
from fastapi import APIRouter, Depends, HTTPException, status, Request
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.security import create_access_token, verify_password
from app.db.database import get_db
from app.models.company import Company
from app.models.employee import Employee
import time

router = APIRouter()

# Simple in-memory rate limiter for Super Admin
_failed_attempts: dict[str, list] = {}
MAX_ATTEMPTS = 5
LOCKOUT_SECONDS = 300


class SuperAdminLogin(BaseModel):
    pin: str


class CompanyAdminLogin(BaseModel):
    email: str
    password: str


class EmployeeLoginEmail(BaseModel):
    email: str
    password: str


class EmployeeLoginCode(BaseModel):
    company_code: str
    employee_email: str
    password: str


@router.post("/super-admin/login")
def super_admin_login(data: SuperAdminLogin, request: Request):
    client_ip = request.client.host if request.client else "unknown"

    # Rate limiting
    now = time.time()
    attempts = _failed_attempts.get(client_ip, [])
    # Clean old attempts
    attempts = [t for t in attempts if now - t < LOCKOUT_SECONDS]
    _failed_attempts[client_ip] = attempts

    if len(attempts) >= MAX_ATTEMPTS:
        raise HTTPException(
            status_code=429,
            detail=f"Too many failed attempts. Try again in {LOCKOUT_SECONDS // 60} minutes."
        )

    if data.pin == settings.SUPER_ADMIN_PIN:
        _failed_attempts.pop(client_ip, None)
        access_token = create_access_token(subject="super-admin")
        return {"access_token": access_token, "token_type": "bearer", "role": "super_admin"}

    # Record failed attempt
    attempts.append(now)
    _failed_attempts[client_ip] = attempts
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid Super Admin PIN",
    )


@router.post("/company-admin/login")
def company_admin_login(data: CompanyAdminLogin, db: Session = Depends(get_db)):
    company = db.query(Company).filter(Company.business_email == data.email).first()
    if not company or not verify_password(data.password, company.password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not company.is_active:
        raise HTTPException(status_code=403, detail="Workspace is awaiting platform approval or has been suspended")

    token = create_access_token(subject=f"company-admin:{company.id}")
    return {
        "access_token": token,
        "token_type": "bearer",
        "role": "company_admin",
        "company_id": company.id,
        "company_name": company.company_name,
        "company_code": company.company_code,
    }


@router.post("/employee/login")
def employee_login(data: EmployeeLoginEmail, db: Session = Depends(get_db)):
    employee = db.query(Employee).filter(Employee.employee_email == data.email).first()
    if not employee or not verify_password(data.password, employee.password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not employee.is_active:
        raise HTTPException(status_code=403, detail="Account deactivated")

    company = db.query(Company).filter(Company.id == employee.company_id).first()
    if not company or not company.is_active:
        raise HTTPException(status_code=403, detail="Company suspended")

    token = create_access_token(subject=f"employee:{employee.id}")
    return {
        "access_token": token,
        "token_type": "bearer",
        "role": employee.role,
        "company_id": employee.company_id,
        "company_name": company.company_name,
        "employee_name": employee.employee_name,
    }


@router.post("/employee/login-code")
def employee_login_code(data: EmployeeLoginCode, db: Session = Depends(get_db)):
    company = db.query(Company).filter(
        Company.company_code == data.company_code,
        Company.is_active == True,
    ).first()
    if not company:
        raise HTTPException(status_code=400, detail="Invalid Company Code")

    employee = db.query(Employee).filter(
        Employee.employee_email == data.employee_email,
        Employee.company_id == company.id,
    ).first()
    if not employee or not verify_password(data.password, employee.password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not employee.is_active:
        raise HTTPException(status_code=403, detail="Account deactivated")

    token = create_access_token(subject=f"employee:{employee.id}")
    return {
        "access_token": token,
        "token_type": "bearer",
        "role": employee.role,
        "company_id": employee.company_id,
        "company_name": company.company_name,
        "employee_name": employee.employee_name,
    }
