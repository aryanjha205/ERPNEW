from pydantic import BaseModel, EmailStr
from typing import Optional

class CompanyRequestOTP(BaseModel):
    email: EmailStr

class CompanyRegister(BaseModel):
    company_name: str
    company_type: str
    owner_name: str
    business_email: EmailStr
    mobile_number: str
    password: str
    otp: str

class CompanyResponse(BaseModel):
    id: int
    company_name: str
    company_type: str
    company_code: str
    is_active: bool
    owner_name: str
    business_email: EmailStr

    class Config:
        from_attributes = True
