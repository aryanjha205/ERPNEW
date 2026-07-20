"""
ERP Module CRUD APIs — All tenant-isolated.
Covers: Dashboard stats, Customers, Suppliers, Inventory, Sales, Purchases,
        Invoices, Attendance, Leave, Payroll, Projects, Tasks, Notifications.
"""
import random
import string
import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func as sqlfunc, extract
from app.db.database import get_db
from app.core.deps import get_current_user
from app.models.erp import (
    Department, Customer, Supplier, InventoryItem, SalesOrder, PurchaseOrder,
    Invoice, Attendance, LeaveRequest, Payroll, Project, Task, Notification
)
from app.models.employee import Employee

router = APIRouter()

# ──────────────────────────── Helpers ────────────────────────────

def _cid(user: dict) -> int:
    cid = user.get("company_id")
    if not cid:
        raise HTTPException(status_code=403, detail="No company context")
    return cid

def _gen_order_number(prefix: str = "SO") -> str:
    return f"{prefix}-{''.join(random.choices(string.digits, k=8))}"

# ──────────────────────────── Dashboard ────────────────────────────

@router.get("/dashboard")
def get_dashboard(
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    cid = _cid(user)
    total_employees = db.query(sqlfunc.count(Employee.id)).filter(Employee.company_id == cid).scalar() or 0
    total_customers = db.query(sqlfunc.count(Customer.id)).filter(Customer.company_id == cid).scalar() or 0
    total_suppliers = db.query(sqlfunc.count(Supplier.id)).filter(Supplier.company_id == cid).scalar() or 0
    total_inventory = db.query(sqlfunc.count(InventoryItem.id)).filter(InventoryItem.company_id == cid).scalar() or 0
    total_sales = db.query(sqlfunc.coalesce(sqlfunc.sum(SalesOrder.total_amount), 0)).filter(SalesOrder.company_id == cid).scalar()
    total_purchases = db.query(sqlfunc.coalesce(sqlfunc.sum(PurchaseOrder.total_amount), 0)).filter(PurchaseOrder.company_id == cid).scalar()
    pending_invoices = db.query(sqlfunc.count(Invoice.id)).filter(Invoice.company_id == cid, Invoice.status == "unpaid").scalar() or 0
    pending_tasks = db.query(sqlfunc.count(Task.id)).filter(Task.company_id == cid, Task.status.in_(["todo", "in_progress"])).scalar() or 0
    active_projects = db.query(sqlfunc.count(Project.id)).filter(Project.company_id == cid, Project.status == "active").scalar() or 0
    unread_notifications = db.query(sqlfunc.count(Notification.id)).filter(
        Notification.company_id == cid, Notification.is_read == False
    ).scalar() or 0

    return {
        "total_employees": total_employees,
        "total_customers": total_customers,
        "total_suppliers": total_suppliers,
        "total_inventory": total_inventory,
        "total_sales": float(total_sales),
        "total_purchases": float(total_purchases),
        "revenue": float(total_sales),
        "expenses": float(total_purchases),
        "profit": float(total_sales) - float(total_purchases),
        "pending_invoices": pending_invoices,
        "pending_tasks": pending_tasks,
        "active_projects": active_projects,
        "unread_notifications": unread_notifications,
    }

# ──────────────────────────── Customers ────────────────────────────

class CustomerCreate(BaseModel):
    name: str
    email: str = ""
    phone: str = ""
    address: str = ""

@router.get("/customers")
def list_customers(user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(Customer).filter(Customer.company_id == _cid(user)).all()

@router.post("/customers")
def create_customer(data: CustomerCreate, user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    c = Customer(company_id=_cid(user), **data.model_dump())
    db.add(c); db.commit(); db.refresh(c)
    return c

@router.delete("/customers/{cust_id}")
def delete_customer(cust_id: int, user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    c = db.query(Customer).filter(Customer.id == cust_id, Customer.company_id == _cid(user)).first()
    if not c: raise HTTPException(404, "Not found")
    db.delete(c); db.commit()
    return {"ok": True}

# ──────────────────────────── Suppliers ────────────────────────────

class SupplierCreate(BaseModel):
    name: str
    email: str = ""
    phone: str = ""
    address: str = ""

@router.get("/suppliers")
def list_suppliers(user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(Supplier).filter(Supplier.company_id == _cid(user)).all()

@router.post("/suppliers")
def create_supplier(data: SupplierCreate, user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    s = Supplier(company_id=_cid(user), **data.model_dump())
    db.add(s); db.commit(); db.refresh(s)
    return s

# ──────────────────────────── Inventory ────────────────────────────

class InventoryCreate(BaseModel):
    name: str
    sku: str = ""
    category: str = ""
    quantity: int = 0
    unit_price: float = 0.0
    reorder_level: int = 10
    warehouse: str = "Main"

@router.get("/inventory")
def list_inventory(user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(InventoryItem).filter(InventoryItem.company_id == _cid(user)).all()

@router.post("/inventory")
def create_inventory(data: InventoryCreate, user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    item = InventoryItem(company_id=_cid(user), **data.model_dump())
    db.add(item); db.commit(); db.refresh(item)
    return item

# ──────────────────────────── Sales ────────────────────────────

class SalesCreate(BaseModel):
    customer_id: Optional[int] = None
    total_amount: float = 0.0
    notes: str = ""

@router.get("/sales")
def list_sales(user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(SalesOrder).filter(SalesOrder.company_id == _cid(user)).order_by(SalesOrder.created_at.desc()).all()

@router.post("/sales")
def create_sale(data: SalesCreate, user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    order = SalesOrder(
        company_id=_cid(user),
        order_number=_gen_order_number("SO"),
        **data.model_dump()
    )
    db.add(order); db.commit(); db.refresh(order)
    return order

# ──────────────────────────── Purchases ────────────────────────────

class PurchaseCreate(BaseModel):
    supplier_id: Optional[int] = None
    total_amount: float = 0.0
    notes: str = ""

@router.get("/purchases")
def list_purchases(user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(PurchaseOrder).filter(PurchaseOrder.company_id == _cid(user)).order_by(PurchaseOrder.created_at.desc()).all()

@router.post("/purchases")
def create_purchase(data: PurchaseCreate, user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    order = PurchaseOrder(
        company_id=_cid(user),
        order_number=_gen_order_number("PO"),
        **data.model_dump()
    )
    db.add(order); db.commit(); db.refresh(order)
    return order

# ──────────────────────────── Invoices ────────────────────────────

class InvoiceCreate(BaseModel):
    customer_id: Optional[int] = None
    total_amount: float = 0.0
    due_date: Optional[str] = None

@router.get("/invoices")
def list_invoices(user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(Invoice).filter(Invoice.company_id == _cid(user)).order_by(Invoice.created_at.desc()).all()

@router.post("/invoices")
def create_invoice(data: InvoiceCreate, user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    inv = Invoice(
        company_id=_cid(user),
        invoice_number=_gen_order_number("INV"),
        customer_id=data.customer_id,
        total_amount=data.total_amount,
        due_date=data.due_date,
    )
    db.add(inv); db.commit(); db.refresh(inv)
    return inv

# ──────────────────────────── Employees (Company-scoped) ────────────────────────────

@router.get("/employees")
def list_employees(user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(Employee).filter(Employee.company_id == _cid(user)).all()

# ──────────────────────────── Attendance ────────────────────────────

@router.get("/attendance")
def list_attendance(user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(Attendance).filter(Attendance.company_id == _cid(user)).order_by(Attendance.date.desc()).limit(100).all()

# ──────────────────────────── Projects ────────────────────────────

class ProjectCreate(BaseModel):
    name: str
    description: str = ""
    budget: float = 0.0

@router.get("/projects")
def list_projects(user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(Project).filter(Project.company_id == _cid(user)).all()

@router.post("/projects")
def create_project(data: ProjectCreate, user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    p = Project(company_id=_cid(user), **data.model_dump())
    db.add(p); db.commit(); db.refresh(p)
    return p

# ──────────────────────────── Tasks ────────────────────────────

class TaskCreate(BaseModel):
    title: str
    description: str = ""
    priority: str = "medium"
    project_id: Optional[int] = None
    assigned_to: Optional[int] = None

@router.get("/tasks")
def list_tasks(user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(Task).filter(Task.company_id == _cid(user)).order_by(Task.created_at.desc()).all()

@router.post("/tasks")
def create_task(data: TaskCreate, user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    t = Task(company_id=_cid(user), **data.model_dump())
    db.add(t); db.commit(); db.refresh(t)
    return t

@router.patch("/tasks/{task_id}/status")
def update_task_status(task_id: int, status: str = Query(...), user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    t = db.query(Task).filter(Task.id == task_id, Task.company_id == _cid(user)).first()
    if not t: raise HTTPException(404, "Not found")
    t.status = status
    db.commit()
    return {"ok": True}

# ──────────────────────────── Notifications ────────────────────────────

@router.get("/notifications")
def list_notifications(user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(Notification).filter(
        Notification.company_id == _cid(user)
    ).order_by(Notification.created_at.desc()).limit(50).all()


# ──────────────────────────── Departments ────────────────────────────

class DepartmentCreate(BaseModel):
    name: str
    description: str = ""

@router.get("/departments")
def list_departments(user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(Department).filter(Department.company_id == _cid(user)).all()

@router.post("/departments")
def create_department(data: DepartmentCreate, user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    d = Department(company_id=_cid(user), name=data.name, description=data.description)
    db.add(d); db.commit(); db.refresh(d)
    return d

# ──────────────────────────── Leaves ────────────────────────────

class LeaveCreate(BaseModel):
    employee_id: int
    leave_type: str
    start_date: str
    end_date: str
    reason: str = ""

@router.get("/leaves")
def list_leaves(user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(LeaveRequest).filter(LeaveRequest.company_id == _cid(user)).all()

@router.post("/leaves")
def create_leave(data: LeaveCreate, user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    s_date = datetime.datetime.strptime(data.start_date, "%Y-%m-%d").date()
    e_date = datetime.datetime.strptime(data.end_date, "%Y-%m-%d").date()
    req = LeaveRequest(
        company_id=_cid(user),
        employee_id=data.employee_id,
        leave_type=data.leave_type,
        start_date=s_date,
        end_date=e_date,
        reason=data.reason,
        status="pending"
    )
    db.add(req); db.commit(); db.refresh(req)
    return req

@router.patch("/leaves/{leave_id}/status")
def update_leave_status(leave_id: int, status: str = Query(...), user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    req = db.query(LeaveRequest).filter(LeaveRequest.id == leave_id, LeaveRequest.company_id == _cid(user)).first()
    if not req: raise HTTPException(404, "Not found")
    req.status = status
    db.commit()
    return {"ok": True}

# ──────────────────────────── Payroll ────────────────────────────

class PayrollCreate(BaseModel):
    employee_id: int
    month: str
    basic_salary: float
    allowances: float = 0.0
    deductions: float = 0.0

@router.get("/payroll")
def list_payroll(user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(Payroll).filter(Payroll.company_id == _cid(user)).all()

@router.post("/payroll")
def create_payroll(data: PayrollCreate, user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    net = data.basic_salary + data.allowances - data.deductions
    pay = Payroll(
        company_id=_cid(user),
        employee_id=data.employee_id,
        month=data.month,
        basic_salary=data.basic_salary,
        allowances=data.allowances,
        deductions=data.deductions,
        net_salary=net,
        status="paid"
    )
    db.add(pay); db.commit(); db.refresh(pay)
    return pay

# ──────────────────────────── Settings ────────────────────────────

from app.models.company import Company
from app.core.templates import get_company_type_config

class SettingsUpdate(BaseModel):
    enable_voice_commands: bool = True
    notifications_enabled: bool = True

@router.get("/settings")
def get_settings(user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    cid = _cid(user)
    company = db.query(Company).filter(Company.id == cid).first()
    c_type = company.company_type if company else "Custom Business"
    tmpl = get_company_type_config(c_type)
    return {
        "enable_voice_commands": True,
        "notifications_enabled": True,
        "company_id": cid,
        "company_name": company.company_name if company else "",
        "company_code": company.company_code if company else "",
        "company_type": c_type,
        "allowed_modules": tmpl.get("modules", []),
        "primary_focus": tmpl.get("primary_focus", ""),
    }

@router.post("/settings")
def update_settings(data: SettingsUpdate, user: dict = Depends(get_current_user)):
    return {"ok": True, "message": "Settings updated"}

@router.get("/reports")
def get_reports(user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    cid = _cid(user)
    
    # Sales Aggregates
    sales_total = db.query(sqlfunc.coalesce(sqlfunc.sum(SalesOrder.total_amount), 0)).filter(SalesOrder.company_id == cid).scalar()
    sales_count = db.query(sqlfunc.count(SalesOrder.id)).filter(SalesOrder.company_id == cid).scalar() or 0
    
    # Purchases Aggregates
    purchases_total = db.query(sqlfunc.coalesce(sqlfunc.sum(PurchaseOrder.total_amount), 0)).filter(PurchaseOrder.company_id == cid).scalar()
    purchases_count = db.query(sqlfunc.count(PurchaseOrder.id)).filter(PurchaseOrder.company_id == cid).scalar() or 0
    
    # Inventory Valuation
    inventory_items = db.query(InventoryItem).filter(InventoryItem.company_id == cid).all()
    inventory_valuation = sum((item.quantity or 0) * (item.unit_price or 0.0) for item in inventory_items)
    inventory_count = len(inventory_items)

    # Customer & Supplier Counts
    customer_count = db.query(sqlfunc.count(Customer.id)).filter(Customer.company_id == cid).scalar() or 0
    supplier_count = db.query(sqlfunc.count(Supplier.id)).filter(Supplier.company_id == cid).scalar() or 0

    # Payroll Total
    payroll_total = db.query(sqlfunc.coalesce(sqlfunc.sum(Payroll.net_salary), 0)).filter(Payroll.company_id == cid).scalar()

    # Attendance summary
    present_count = db.query(sqlfunc.count(Attendance.id)).filter(Attendance.company_id == cid, Attendance.status == "present").scalar() or 0
    absent_count = db.query(sqlfunc.count(Attendance.id)).filter(Attendance.company_id == cid, Attendance.status == "absent").scalar() or 0

    return {
        "summary": {
            "total_revenue": float(sales_total),
            "total_expenses": float(purchases_total) + float(payroll_total),
            "net_profit": float(sales_total) - (float(purchases_total) + float(payroll_total)),
            "inventory_valuation": float(inventory_valuation),
        },
        "sales": {"total_amount": float(sales_total), "total_orders": sales_count},
        "purchases": {"total_amount": float(purchases_total), "total_orders": purchases_count},
        "payroll": {"total_payout": float(payroll_total)},
        "inventory": {"item_types": inventory_count, "valuation": float(inventory_valuation)},
        "crm": {"customers": customer_count, "suppliers": supplier_count},
        "attendance": {"present": present_count, "absent": absent_count}
    }


# ──────────────────────────── AI Voice Provider Integration ────────────────────────────

from app.services.ai_voice import get_ai_voice_provider

class VoiceCommandRequest(BaseModel):
    transcript: str

@router.post("/ai-voice")
def process_voice_command(data: VoiceCommandRequest, user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    cid = _cid(user)
    provider = get_ai_voice_provider()
    return provider.process_command(transcript=data.transcript, company_id=cid, db=db)


