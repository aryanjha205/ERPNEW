import random
import string
import datetime
import requests
import qrcode
import base64
from io import BytesIO
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.db.database import get_db
from app.models.company import Company
from app.models.otp import OTPRequest
from app.schemas.company import CompanyRequestOTP, CompanyRegister, CompanyResponse
from app.core.config import settings
from app.core.security import get_password_hash, hash_otp, validate_password
from app.core.deps import require_super_admin
from app.models.employee import Employee

router = APIRouter()

def generate_company_code():
    chars = string.ascii_uppercase + string.digits
    return "COMP-" + ''.join(random.choices(chars, k=6))

@router.post("/request-otp")
def request_otp(data: CompanyRequestOTP, db: Session = Depends(get_db)):
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
    try:
        res = requests.post(
            settings.OTP_SERVICE_URL, 
            json={"email": data.email, "otp": otp_code}
        )
        res.raise_for_status()
    except Exception as e:
        db.delete(otp_record)
        db.commit()
        raise HTTPException(status_code=500, detail="Failed to send OTP via email service")

    return {"message": "OTP sent successfully"}

@router.post("/register")
def register_company(data: CompanyRegister, db: Session = Depends(get_db)):
    try:
        validate_password(data.password)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    # Validate OTP
    otp_record = db.query(OTPRequest).filter(
        OTPRequest.email == data.business_email,
        OTPRequest.otp == hash_otp(data.business_email, data.otp),
        OTPRequest.is_used == False,
        OTPRequest.expires_at > datetime.datetime.now(datetime.timezone.utc)
    ).order_by(OTPRequest.created_at.desc()).first()

    if not otp_record:
        raise HTTPException(status_code=400, detail="Invalid or expired OTP")

    # Mark OTP as used
    otp_record.is_used = True
    
    # Generate unique company code
    while True:
        code = generate_company_code()
        if not db.query(Company).filter(Company.company_code == code).first():
            break

    # Create Company
    hashed_pwd = get_password_hash(data.password)
    new_company = Company(
        company_name=data.company_name,
        company_type=data.company_type,
        owner_name=data.owner_name,
        business_email=data.business_email,
        mobile_number=data.mobile_number,
        password=hashed_pwd,
        company_code=code,
    )
    db.add(new_company)
    db.commit()
    db.refresh(new_company)

    # Generate QR Code for Company Code
    qr = qrcode.make(code)
    buffered = BytesIO()
    qr.save(buffered, format="PNG")
    qr_base64 = base64.b64encode(buffered.getvalue()).decode("utf-8")

    return {
        "message": "Company registered successfully",
        "company_code": code,
        "qr_code_base64": f"data:image/png;base64,{qr_base64}"
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
