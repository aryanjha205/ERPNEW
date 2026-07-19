"""
JWT Authentication Dependencies for route protection.
"""
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from sqlalchemy.orm import Session
from app.core.config import settings
from app.db.database import get_db
from app.models.employee import Employee
from app.models.company import Company

security = HTTPBearer()

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
):
    """Decode JWT and return user info dict."""
    token = credentials.credentials
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        subject: str = payload.get("sub")
        if subject is None:
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    # Super admin
    if subject == "super-admin":
        return {"role": "super_admin", "sub": subject, "company_id": None}

    # Company admin (subject = "company-admin:<company_id>")
    if subject.startswith("company-admin:"):
        company_id = int(subject.split(":")[1])
        company = db.query(Company).filter(Company.id == company_id).first()
        if not company or not company.is_active:
            raise HTTPException(status_code=401, detail="Company suspended or unavailable")
        return {"role": "company_admin", "sub": subject, "company_id": company_id}

    # Employee (subject = "employee:<employee_id>")
    if subject.startswith("employee:"):
        emp_id = int(subject.split(":")[1])
        employee = db.query(Employee).filter(Employee.id == emp_id).first()
        if not employee or not employee.is_active:
            raise HTTPException(status_code=401, detail="Account deactivated")
        company = db.query(Company).filter(Company.id == employee.company_id).first()
        if not company or not company.is_active:
            raise HTTPException(status_code=401, detail="Company suspended or unavailable")
        return {
            "role": employee.role,
            "sub": subject,
            "company_id": employee.company_id,
            "employee_id": employee.id,
            "employee_name": employee.employee_name,
        }

    raise HTTPException(status_code=401, detail="Unknown token subject")


def require_super_admin(current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "super_admin":
        raise HTTPException(status_code=403, detail="Super Admin access required")
    return current_user


def require_company_admin(current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in ("company_admin", "super_admin"):
        raise HTTPException(status_code=403, detail="Company Admin access required")
    return current_user
