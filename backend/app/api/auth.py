"""
Authentication API — Super Admin PIN, Company Admin, Employee Login.
"""
from datetime import datetime, timedelta, timezone
import time

from fastapi import APIRouter, Depends, HTTPException, status, Request
from jose import JWTError, jwt
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.audit import record_audit_event
from app.core.config import settings
from app.core.security import create_access_token, create_refresh_token, verify_password
from app.db.database import get_db
from app.models.company import Company
from app.models.employee import Employee
from app.models.session_token import RefreshToken

router = APIRouter()

# Simple in-memory rate limiter for Super Admin
_failed_attempts: dict[str, list[float]] = {}
_issued_refreshes: set[str] = set()

MAX_ATTEMPTS = settings.SUPER_ADMIN_MAX_ATTEMPTS
LOCKOUT_SECONDS = settings.SUPER_ADMIN_LOCKOUT_SECONDS


def _client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def _build_session_response(
    *,
    db: Session,
    subject: str,
    role: str,
    company: Company | None = None,
    employee: Employee | None = None,
    issue_refresh_token: bool = True,
) -> dict:
    access_token = create_access_token(subject=subject)

    response = {
        "access_token": access_token,
        "token_type": "bearer",
        "role": role,
    }
    if issue_refresh_token:
        refresh_token, jti = create_refresh_token(subject=subject)
        expires_at = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
        db.add(
            RefreshToken(
                jti=jti,
                subject=subject,
                company_id=company.id if company else None,
                expires_at=expires_at,
            )
        )
        response["refresh_token"] = refresh_token
    if company:
        response.update(
            {
                "company_id": company.id,
                "company_name": company.company_name,
                "company_code": company.company_code,
                "company_type": company.company_type,
            }
        )
    if employee:
        response.update({"employee_name": employee.employee_name})
    return response


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


class RefreshRequest(BaseModel):
    refresh_token: str


class LogoutRequest(BaseModel):
    refresh_token: str


@router.post("/super-admin/login")
def super_admin_login(data: SuperAdminLogin, request: Request, db: Session = Depends(get_db)):
    client_ip = _client_ip(request)

    # Rate limiting
    now = time.time()
    attempts = _failed_attempts.get(client_ip, [])
    # Clean old attempts
    attempts = [t for t in attempts if now - t < LOCKOUT_SECONDS]
    _failed_attempts[client_ip] = attempts

    if len(attempts) >= MAX_ATTEMPTS:
        record_audit_event(
            db,
            action="super_admin_login_locked",
            resource="super_admin",
            details="Repeated failed PIN attempts triggered a temporary lockout.",
            ip_address=client_ip,
            user_subject="super-admin",
        )
        db.commit()
        raise HTTPException(
            status_code=429,
            detail=f"Too many failed attempts. Try again in {LOCKOUT_SECONDS // 60} minutes."
        )

    if data.pin == settings.SUPER_ADMIN_PIN:
        _failed_attempts.pop(client_ip, None)
        session = _build_session_response(db=db, subject="super-admin", role="super_admin")
        record_audit_event(
            db,
            action="super_admin_login_success",
            resource="super_admin",
            details="Successful platform administrator login.",
            ip_address=client_ip,
            user_subject="super-admin",
        )
        db.commit()
        return session

    # Record failed attempt
    attempts.append(now)
    _failed_attempts[client_ip] = attempts
    record_audit_event(
        db,
        action="super_admin_login_failed",
        resource="super_admin",
        details="Invalid Super Admin PIN entered.",
        ip_address=client_ip,
        user_subject="super-admin",
    )
    db.commit()
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid Super Admin PIN",
    )


@router.post("/company-admin/login")
def company_admin_login(data: CompanyAdminLogin, request: Request, db: Session = Depends(get_db)):
    company = db.query(Company).filter(Company.business_email == data.email).first()
    if not company or not verify_password(data.password, company.password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not company.is_active:
        raise HTTPException(status_code=403, detail="Workspace is awaiting platform approval or has been suspended")

    session = _build_session_response(
        db=db,
        subject=f"company-admin:{company.id}",
        role="company_admin",
        company=company,
    )
    record_audit_event(
        db,
        action="company_admin_login",
        resource="company",
        details="Company administrator signed in.",
        company_id=company.id,
        user_subject=f"company-admin:{company.id}",
        ip_address=_client_ip(request),
    )
    db.commit()
    return session


@router.post("/employee/login")
def employee_login(data: EmployeeLoginEmail, request: Request, db: Session = Depends(get_db)):
    employee = db.query(Employee).filter(Employee.employee_email == data.email).first()
    if not employee or not verify_password(data.password, employee.password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not employee.is_active:
        raise HTTPException(status_code=403, detail="Account deactivated")

    company = db.query(Company).filter(Company.id == employee.company_id).first()
    if not company or not company.is_active:
        raise HTTPException(status_code=403, detail="Company suspended")

    session = _build_session_response(
        db=db,
        subject=f"employee:{employee.id}",
        role=employee.role,
        company=company,
        employee=employee,
    )
    record_audit_event(
        db,
        action="employee_login",
        resource="employee",
        details="Employee signed in.",
        company_id=employee.company_id,
        user_subject=f"employee:{employee.id}",
        ip_address=_client_ip(request),
    )
    db.commit()
    return session


@router.post("/employee/login-code")
def employee_login_code(data: EmployeeLoginCode, request: Request, db: Session = Depends(get_db)):
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

    session = _build_session_response(
        db=db,
        subject=f"employee:{employee.id}",
        role=employee.role,
        company=company,
        employee=employee,
    )
    record_audit_event(
        db,
        action="employee_login_with_code",
        resource="employee",
        details="Employee signed in using company code.",
        company_id=employee.company_id,
        user_subject=f"employee:{employee.id}",
        ip_address=_client_ip(request),
    )
    db.commit()
    return session


@router.post("/refresh")
def refresh_session(data: RefreshRequest, db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(data.refresh_token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")

    if payload.get("typ") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    jti = payload.get("jti")
    subject = payload.get("sub")
    if not jti or not subject:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    stored = db.query(RefreshToken).filter(
        RefreshToken.jti == jti,
        RefreshToken.subject == subject,
        RefreshToken.revoked_at.is_(None),
        RefreshToken.expires_at > datetime.now(timezone.utc),
    ).first()
    if not stored:
        raise HTTPException(status_code=401, detail="Refresh token revoked or expired")

    if subject == "super-admin":
        return {
            "access_token": create_access_token(subject=subject),
            "token_type": "bearer",
            "role": "super_admin",
            "refresh_token": data.refresh_token,
        }

    if subject.startswith("company-admin:"):
        company_id = int(subject.split(":", 1)[1])
        company = db.query(Company).filter(Company.id == company_id, Company.is_active.is_(True)).first()
        if not company:
            raise HTTPException(status_code=401, detail="Workspace is unavailable")
        return {
            **_build_session_response(
                db=db,
                subject=subject,
                role="company_admin",
                company=company,
                issue_refresh_token=False,
            ),
            "refresh_token": data.refresh_token,
        }

    if subject.startswith("employee:"):
        emp_id = int(subject.split(":", 1)[1])
        employee = db.query(Employee).filter(Employee.id == emp_id, Employee.is_active.is_(True)).first()
        if not employee:
            raise HTTPException(status_code=401, detail="Account deactivated")
        company = db.query(Company).filter(Company.id == employee.company_id, Company.is_active.is_(True)).first()
        if not company:
            raise HTTPException(status_code=401, detail="Company suspended")
        return {
            **_build_session_response(
                db=db,
                subject=subject,
                role=employee.role,
                company=company,
                employee=employee,
                issue_refresh_token=False,
            ),
            "refresh_token": data.refresh_token,
        }

    raise HTTPException(status_code=401, detail="Unknown refresh token subject")


@router.post("/logout")
def logout_session(data: LogoutRequest, db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(data.refresh_token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        return {"message": "Logged out"}

    jti = payload.get("jti")
    subject = payload.get("sub")
    if jti and subject:
        stored = db.query(RefreshToken).filter(
            RefreshToken.jti == jti,
            RefreshToken.subject == subject,
            RefreshToken.revoked_at.is_(None),
        ).first()
        if stored:
            stored.revoked_at = datetime.now(timezone.utc)
            record_audit_event(
                db,
                action="logout",
                resource="session",
                details="Session revoked by the user.",
                company_id=stored.company_id,
                user_subject=subject,
            )
            db.commit()

    return {"message": "Logged out"}
