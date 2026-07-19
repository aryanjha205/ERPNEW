"""
Employee Registration & Login API Routes.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.company import Company
from app.models.employee import Employee
from app.core.security import get_password_hash, verify_password, create_access_token

router = APIRouter()


class EmployeeRegister(BaseModel):
    company_code: str
    employee_name: str
    employee_email: EmailStr
    mobile_number: str
    department: str
    designation: str
    password: str


class EmployeeLogin(BaseModel):
    email: str
    password: str


class CompanyCodeLogin(BaseModel):
    company_code: str
    employee_email: str
    password: str


@router.post("/register")
def register_employee(data: EmployeeRegister, db: Session = Depends(get_db)):
    # Validate Company Code
    company = db.query(Company).filter(
        Company.company_code == data.company_code,
        Company.is_active == True
    ).first()
    if not company:
        raise HTTPException(status_code=400, detail="Invalid Company Code")

    # Check if email already exists
    existing = db.query(Employee).filter(Employee.employee_email == data.employee_email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    hashed = get_password_hash(data.password)
    employee = Employee(
        company_id=company.id,
        employee_name=data.employee_name,
        employee_email=data.employee_email,
        mobile_number=data.mobile_number,
        department=data.department,
        designation=data.designation,
        password=hashed,
        role="employee",
    )
    db.add(employee)
    db.commit()
    db.refresh(employee)

    return {"message": "Employee registered successfully", "employee_id": employee.id}


@router.post("/login")
def login_employee(data: EmployeeLogin, db: Session = Depends(get_db)):
    employee = db.query(Employee).filter(Employee.employee_email == data.email).first()
    if not employee or not verify_password(data.password, employee.password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not employee.is_active:
        raise HTTPException(status_code=403, detail="Account deactivated")

    # Check company is active
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


@router.post("/login-code")
def login_with_company_code(data: CompanyCodeLogin, db: Session = Depends(get_db)):
    company = db.query(Company).filter(
        Company.company_code == data.company_code,
        Company.is_active == True
    ).first()
    if not company:
        raise HTTPException(status_code=400, detail="Invalid Company Code")

    employee = db.query(Employee).filter(
        Employee.employee_email == data.employee_email,
        Employee.company_id == company.id
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
