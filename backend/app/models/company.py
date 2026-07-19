from sqlalchemy import Column, Integer, String, Boolean, DateTime
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from .base import Base

class Company(Base):
    __tablename__ = "companies"

    id = Column(Integer, primary_key=True, index=True)
    company_name = Column(String, index=True, nullable=False)
    company_type = Column(String, nullable=False)
    owner_name = Column(String, nullable=False)
    business_email = Column(String, unique=True, index=True, nullable=False)
    mobile_number = Column(String, nullable=False)
    password = Column(String, nullable=False)
    company_code = Column(String, unique=True, index=True, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    employees = relationship("Employee", back_populates="company", cascade="all, delete-orphan")
