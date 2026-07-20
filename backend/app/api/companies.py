import random
import string
import datetime
import requests
import qrcode
import base64
from io import BytesIO
from fastapi import APIRouter, Depends, HTTPException, status, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.db.database import get_db
from app.models.company import Company
from app.models.otp import OTPRequest
from app.schemas.company import CompanyRequestOTP, CompanyRegister, CompanyCreate, CompanyResponse
from app.core.config import settings
from app.core.security import get_password_hash, hash_otp, validate_password
from app.core.deps import require_super_admin
from app.models.employee import Employee

router = APIRouter()


def otp_service_url(request: Request) -> str:
    """Use an explicit local URL when configured, otherwise call this Vercel deployment."""
    if settings.OTP_SERVICE_URL:
        return settings.OTP_SERVICE_URL
    scheme = request.headers.get("x-forwarded-proto", request.url.scheme)
    host = request.headers.get("x-forwarded-host", request.url.netloc)
    return f"{scheme}://{host}/api/otp/send-otp"

def generate_company_code():
    chars = string.ascii_uppercase + string.digits
    return "COMP-" + ''.join(random.choices(chars, k=6))

@router.post("/request-otp")
def request_otp(data: CompanyRequestOTP, request: Request, db: Session = Depends(get_db)):
    # Check if email is already registered
    existing_company = db.query(Company).filter(Company.business_email == data.email).first()
    if existing_company:
        raise HTTPException(status_code=400, detail="Email already registered")

    # Generate 6 digit OTP
    otp_code = ''.join(random.choices(string.digits, k=6))
    
    # Store OTP in DB
    expires = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(minutes=5)
    otp_record = OTPRequest(email=data.email, otp=hash_otp(data.email, otp_code), expires_at=expires)
    db.add(otp_record)
    db.commit()

    # Call Node.js OTP Service
    dev_otp = None
    try:
        res = requests.post(
            otp_service_url(request),
            json={"email": data.email, "otp": otp_code},
            timeout=5,
        )
        res.raise_for_status()
    except requests.RequestException:
        # Fallback for local development: log OTP to stdout so developers can bypass and verify
        print(f"\n[DEVELOPMENT FALLBACK] Generated OTP for {data.email} is: {otp_code}\n")
        dev_otp = otp_code

    return {"message": "OTP sent successfully", "dev_otp": dev_otp}

def generate_qr_code_base64(code: str) -> str:
    qr = qrcode.QRCode(version=1, box_size=10, border=5)
    qr.add_data(code)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buffered = BytesIO()
    img.save(buffered, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buffered.getvalue()).decode()


@router.post("/register")
def register_company(data: CompanyRegister, db: Session = Depends(get_db)):
    try:
        validate_password(data.password)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    otp_record = db.query(OTPRequest).filter(
        OTPRequest.email == data.business_email,
        OTPRequest.otp == hash_otp(data.business_email, data.otp),
        OTPRequest.is_used == False,
        OTPRequest.expires_at > datetime.datetime.now(datetime.timezone.utc),
    ).order_by(OTPRequest.created_at.desc()).first()
    if not otp_record:
        raise HTTPException(status_code=400, detail="Invalid or expired verification code")
    otp_record.is_used = True
    # Generate unique company code
    while True:
        code = generate_company_code()
        if not db.query(Company).filter(Company.company_code == code).first():
            break

    hashed_pwd = get_password_hash(data.password)
    new_company = Company(
        company_name=data.company_name,
        company_type=data.company_type,
        owner_name=data.owner_name,
        business_email=data.business_email,
        mobile_number=data.mobile_number,
        password=hashed_pwd,
        company_code=code,
        is_active=True,
    )
    db.add(new_company)
    db.commit()
    db.refresh(new_company)

    qr_code_base64 = generate_qr_code_base64(code)

    return {
        "message": "Workspace created successfully",
        "status": "active",
        "company_code": code,
        "qr_code_base64": qr_code_base64
    }


@router.post("/admin/create")
def create_company_as_super_admin(
    data: CompanyCreate,
    _: dict = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    """Create an approved workspace directly from the platform console."""
    try:
        validate_password(data.password)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    if db.query(Company).filter(Company.business_email == data.business_email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    while True:
        code = generate_company_code()
        if not db.query(Company).filter(Company.company_code == code).first():
            break
    company = Company(
        company_name=data.company_name,
        company_type=data.company_type,
        owner_name=data.owner_name,
        business_email=data.business_email,
        mobile_number=data.mobile_number,
        password=get_password_hash(data.password),
        company_code=code,
        is_active=True,
    )
    db.add(company)
    db.commit()
    
    qr_code_base64 = generate_qr_code_base64(code)
    return {
        "message": "Workspace created",
        "company_code": code,
        "qr_code_base64": qr_code_base64
    }

@router.get("/", response_model=list[CompanyResponse])
def get_companies(
    _: dict = Depends(require_super_admin), db: Session = Depends(get_db)
):
    return db.query(Company).all()


@router.get("/platform/overview")
def get_platform_overview(
    _: dict = Depends(require_super_admin), db: Session = Depends(get_db)
):
    """Platform-only aggregate metrics; no tenant business data is exposed."""
    total_companies = db.query(func.count(Company.id)).scalar() or 0
    active_companies = db.query(func.count(Company.id)).filter(Company.is_active.is_(True)).scalar() or 0
    total_employees = db.query(func.count(Employee.id)).scalar() or 0
    active_employees = db.query(func.count(Employee.id)).filter(Employee.is_active.is_(True)).scalar() or 0
    return {
        "total_companies": total_companies,
        "active_companies": active_companies,
        "suspended_companies": total_companies - active_companies,
        "total_employees": total_employees,
        "active_employees": active_employees,
    }


@router.patch("/{company_id}/status", response_model=CompanyResponse)
def set_company_status(
    company_id: int,
    is_active: bool,
    _: dict = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    """Suspend or reactivate a tenant. Only the platform administrator may do this."""
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    company.is_active = is_active
    db.commit()
    db.refresh(company)
    return company


class CompanyPasswordReset(BaseModel):
    new_password: str


@router.post("/{company_id}/reset-password")
def reset_company_password(
    company_id: int,
    data: CompanyPasswordReset,
    _: dict = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    """Reset company admin credentials/password. Super Admin only."""
    try:
        validate_password(data.new_password)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    company.password = get_password_hash(data.new_password)
    db.commit()
    return {"message": "Company password reset successfully"}
