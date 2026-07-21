import random
import string
import datetime
from typing import Any
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
from app.core.audit import record_audit_event
from app.core.templates import get_company_type_config
from app.models.employee import Employee

router = APIRouter()

_otp_state: dict[str, dict[str, Any]] = {}


def otp_service_url(request: Request) -> str:
    """Use an explicit local URL when configured, otherwise call this Vercel deployment."""
    if settings.OTP_SERVICE_URL:
        base = settings.OTP_SERVICE_URL.rstrip("/")
        return base if base.endswith("/send-otp") else f"{base}/send-otp"
    scheme = request.headers.get("x-forwarded-proto", request.url.scheme)
    host = request.headers.get("x-forwarded-host", request.url.netloc)
    return f"{scheme}://{host}/api/otp/send-otp"


def _otp_bucket(email: str) -> dict[str, Any]:
    key = email.lower().strip()
    bucket = _otp_state.setdefault(key, {"attempts": 0, "last_sent_at": None, "blocked_until": None})
    now = datetime.datetime.now(datetime.timezone.utc)
    if bucket.get("blocked_until") and bucket["blocked_until"] <= now:
        bucket["blocked_until"] = None
        bucket["attempts"] = 0
    return bucket

def generate_company_code():
    chars = string.ascii_uppercase + string.digits
    return "COMP-" + ''.join(random.choices(chars, k=6))

@router.post("/request-otp")
def request_otp(data: CompanyRequestOTP, request: Request, db: Session = Depends(get_db)):
    # Check if email is already registered
    existing_company = db.query(Company).filter(Company.business_email == data.email).first()
    if existing_company:
        raise HTTPException(status_code=400, detail="Email already registered")

    bucket = _otp_bucket(data.email)
    now = datetime.datetime.now(datetime.timezone.utc)
    if bucket.get("blocked_until") and bucket["blocked_until"] > now:
        retry_after = int((bucket["blocked_until"] - now).total_seconds())
        raise HTTPException(status_code=429, detail=f"OTP request temporarily locked. Try again in {retry_after} seconds.")

    if bucket.get("last_sent_at"):
        elapsed = (now - bucket["last_sent_at"]).total_seconds()
        if elapsed < settings.OTP_RESEND_COOLDOWN_SECONDS:
            retry_after = settings.OTP_RESEND_COOLDOWN_SECONDS - int(elapsed)
            raise HTTPException(status_code=429, detail=f"Please wait {retry_after} seconds before requesting another OTP.")

    # Generate 6 digit OTP
    otp_code = ''.join(random.choices(string.digits, k=6))
    
    # Store OTP in DB
    expires = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(minutes=5)
    otp_record = OTPRequest(email=data.email, otp=hash_otp(data.email, otp_code), expires_at=expires)
    db.add(otp_record)
    db.commit()
    bucket["last_sent_at"] = now
    bucket["attempts"] = 0
    _otp_state[data.email.lower().strip()] = bucket

    email_sent = False
    dev_otp = None

    # 1. Attempt direct python smtplib send if credentials configured
    smtp_user = getattr(settings, 'SMTP_USER', None)
    smtp_pass = getattr(settings, 'SMTP_PASSWORD', None)
    smtp_host = getattr(settings, 'SMTP_HOST', 'smtp.gmail.com')
    smtp_port = getattr(settings, 'SMTP_PORT', 587)

    if smtp_user and smtp_pass:
        try:
            import smtplib
            from email.mime.text import MIMEText
            from email.mime.multipart import MIMEMultipart

            msg = MIMEMultipart()
            msg['From'] = smtp_user
            msg['To'] = data.email
            msg['Subject'] = 'Your Nexus ERP Verification Code'
            msg.attach(MIMEText(f"Your verification code is: {otp_code}. It will expire in 5 minutes.", 'plain'))

            server = smtplib.SMTP(smtp_host, int(smtp_port), timeout=5)
            server.starttls()
            server.login(smtp_user, smtp_pass)
            server.send_message(msg)
            server.quit()
            email_sent = True
        except Exception as exc:
            print(f"\n[SMTP Email Error]: {exc}\n")

    # 2. Attempt call to Node.js service endpoint if specified and smtplib not used
    if not email_sent and settings.OTP_SERVICE_URL:
        try:
            res = requests.post(
                otp_service_url(request),
                json={"email": data.email, "otp": otp_code},
                timeout=3,
            )
            if res.ok:
                email_sent = True
        except requests.RequestException as exc:
            print(f"\n[OTP Service Request Failed]: {exc}\n")

    # 3. If email could not be delivered, provide dev_otp so registration is never blocked
    if not email_sent:
        print(f"\n[DEV FALLBACK] Verification code for {data.email} is: {otp_code}\n")
        dev_otp = otp_code

    record_audit_event(
        db,
        action="otp_requested",
        resource="company_registration",
        details="Verification OTP requested for workspace onboarding.",
        user_subject=data.email,
    )
    db.commit()

    return {
        "message": "OTP processed successfully",
        "email_sent": email_sent,
        "dev_otp": dev_otp,
        "cooldown_seconds": settings.OTP_RESEND_COOLDOWN_SECONDS,
        "expires_in_seconds": 300,
    }

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

    bucket = _otp_bucket(data.business_email)
    if bucket.get("blocked_until") and bucket["blocked_until"] > datetime.datetime.now(datetime.timezone.utc):
        raise HTTPException(status_code=429, detail="Too many invalid OTP attempts. Please request a new code later.")

    otp_record = db.query(OTPRequest).filter(
        OTPRequest.email == data.business_email,
        OTPRequest.otp == hash_otp(data.business_email, data.otp),
        OTPRequest.is_used == False,
        OTPRequest.expires_at > datetime.datetime.now(datetime.timezone.utc),
    ).order_by(OTPRequest.created_at.desc()).first()
    if not otp_record:
        bucket["attempts"] = int(bucket.get("attempts", 0)) + 1
        if bucket["attempts"] >= settings.OTP_MAX_ATTEMPTS:
            bucket["blocked_until"] = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(minutes=10)
        _otp_state[data.business_email.lower().strip()] = bucket
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
    _otp_state.pop(data.business_email.lower().strip(), None)

    template = get_company_type_config(data.company_type)
    record_audit_event(
        db,
        action="company_registered",
        resource="company",
        details=f"Workspace created for {data.company_name}.",
        company_id=new_company.id,
        user_subject=data.business_email,
    )
    db.commit()

    qr_code_base64 = generate_qr_code_base64(code)

    return {
        "message": "Workspace created successfully",
        "status": "active",
        "company_code": code,
        "qr_code_base64": qr_code_base64,
        "template": template,
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
    record_audit_event(
        db,
        action="company_created_by_super_admin",
        resource="company",
        details=f"Workspace created for {company.company_name}.",
        company_id=company.id,
        user_subject="super-admin",
    )
    db.commit()
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
    record_audit_event(
        db,
        action="company_status_changed",
        resource="company",
        details=f"Workspace marked as {'active' if is_active else 'suspended' }.",
        company_id=company.id,
        user_subject="super-admin",
    )
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
    record_audit_event(
        db,
        action="company_password_reset",
        resource="company",
        details="Company administrator password was reset by the platform administrator.",
        company_id=company.id,
        user_subject="super-admin",
    )
    db.commit()
    return {"message": "Company password reset successfully"}
