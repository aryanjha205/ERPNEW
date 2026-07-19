from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from .base import Base

class Employee(Base):
    __tablename__ = "employees"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    employee_name = Column(String, nullable=False)
    employee_email = Column(String, unique=True, index=True, nullable=False)
    mobile_number = Column(String, nullable=False)
    department = Column(String, nullable=False)
    designation = Column(String, nullable=False)
    password = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    role = Column(String, default="employee") # e.g. employee, manager, admin
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    company = relationship("Company", back_populates="employees")
