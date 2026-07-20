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
        return 1
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

@router.delete("/suppliers/{sup_id}")
def delete_supplier(sup_id: int, user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    s = db.query(Supplier).filter(Supplier.id == sup_id, Supplier.company_id == _cid(user)).first()
    if not s: raise HTTPException(404, "Not found")
    db.delete(s); db.commit()
    return {"ok": True}

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

@router.delete("/inventory/{item_id}")
def delete_inventory(item_id: int, user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    item = db.query(InventoryItem).filter(InventoryItem.id == item_id, InventoryItem.company_id == _cid(user)).first()
    if not item: raise HTTPException(404, "Not found")
    db.delete(item); db.commit()
    return {"ok": True}

@router.patch("/inventory/{item_id}/stock")
def update_inventory_stock(item_id: int, quantity: int = Query(...), user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    item = db.query(InventoryItem).filter(InventoryItem.id == item_id, InventoryItem.company_id == _cid(user)).first()
    if not item: raise HTTPException(404, "Not found")
    item.quantity = quantity
    db.commit()
    return {"ok": True, "quantity": item.quantity}

# ──────────────────────────── Sales ────────────────────────────

class SalesCreate(BaseModel):
    customer_id: Optional[int] = None
    total_amount: float = 0.0
    notes: str = ""

@router.get("/sales")
def list_sales(user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    cid = _cid(user)
    rows = (
        db.query(SalesOrder, Customer.name.label("customer_name"))
        .outerjoin(Customer, SalesOrder.customer_id == Customer.id)
        .filter(SalesOrder.company_id == cid)
        .order_by(SalesOrder.created_at.desc())
        .all()
    )
    result = []
    for order, cust_name in rows:
        result.append({
            "id": order.id,
            "company_id": order.company_id,
            "order_number": order.order_number,
            "customer_id": order.customer_id,
            "customer_name": cust_name or "General Customer",
            "total_amount": order.total_amount,
            "status": order.status,
            "notes": order.notes,
            "created_at": order.created_at.isoformat() if order.created_at else ""
        })
    return result

@router.post("/sales")
def create_sale(data: SalesCreate, user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    order = SalesOrder(
        company_id=_cid(user),
        order_number=_gen_order_number("SO"),
        **data.model_dump()
    )
    db.add(order); db.commit(); db.refresh(order)
    return order

@router.patch("/sales/{order_id}/status")
def update_sale_status(order_id: int, status: str = Query(...), user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    order = db.query(SalesOrder).filter(SalesOrder.id == order_id, SalesOrder.company_id == _cid(user)).first()
    if not order: raise HTTPException(404, "Not found")
    order.status = status
    db.commit()
    return {"ok": True}

@router.delete("/sales/{order_id}")
def delete_sale(order_id: int, user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    order = db.query(SalesOrder).filter(SalesOrder.id == order_id, SalesOrder.company_id == _cid(user)).first()
    if not order: raise HTTPException(404, "Not found")
    db.delete(order); db.commit()
    return {"ok": True}

# ──────────────────────────── Purchases ────────────────────────────

class PurchaseCreate(BaseModel):
    supplier_id: Optional[int] = None
    total_amount: float = 0.0
    notes: str = ""

@router.get("/purchases")
def list_purchases(user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    cid = _cid(user)
    rows = (
        db.query(PurchaseOrder, Supplier.name.label("supplier_name"))
        .outerjoin(Supplier, PurchaseOrder.supplier_id == Supplier.id)
        .filter(PurchaseOrder.company_id == cid)
        .order_by(PurchaseOrder.created_at.desc())
        .all()
    )
    result = []
    for order, sup_name in rows:
        result.append({
            "id": order.id,
            "company_id": order.company_id,
            "order_number": order.order_number,
            "supplier_id": order.supplier_id,
            "supplier_name": sup_name or "General Supplier",
            "total_amount": order.total_amount,
            "status": order.status,
            "notes": order.notes,
            "created_at": order.created_at.isoformat() if order.created_at else ""
        })
    return result

@router.post("/purchases")
def create_purchase(data: PurchaseCreate, user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    order = PurchaseOrder(
        company_id=_cid(user),
        order_number=_gen_order_number("PO"),
        **data.model_dump()
    )
    db.add(order); db.commit(); db.refresh(order)
    return order

@router.patch("/purchases/{order_id}/status")
def update_purchase_status(order_id: int, status: str = Query(...), user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    order = db.query(PurchaseOrder).filter(PurchaseOrder.id == order_id, PurchaseOrder.company_id == _cid(user)).first()
    if not order: raise HTTPException(404, "Not found")
    order.status = status
    db.commit()
    return {"ok": True}

@router.delete("/purchases/{order_id}")
def delete_purchase(order_id: int, user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    order = db.query(PurchaseOrder).filter(PurchaseOrder.id == order_id, PurchaseOrder.company_id == _cid(user)).first()
    if not order: raise HTTPException(404, "Not found")
    db.delete(order); db.commit()
    return {"ok": True}

# ──────────────────────────── Invoices ────────────────────────────

class InvoiceCreate(BaseModel):
    customer_id: Optional[int] = None
    total_amount: float = 0.0
    due_date: Optional[str] = None

@router.get("/invoices")
def list_invoices(user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    cid = _cid(user)
    rows = (
        db.query(Invoice, Customer.name.label("customer_name"))
        .outerjoin(Customer, Invoice.customer_id == Customer.id)
        .filter(Invoice.company_id == cid)
        .order_by(Invoice.created_at.desc())
        .all()
    )
    result = []
    for inv, cust_name in rows:
        result.append({
            "id": inv.id,
            "company_id": inv.company_id,
            "invoice_number": inv.invoice_number,
            "customer_id": inv.customer_id,
            "customer_name": cust_name or "Client",
            "total_amount": inv.total_amount,
            "paid_amount": inv.paid_amount,
            "status": inv.status,
            "due_date": str(inv.due_date) if inv.due_date else "",
            "created_at": inv.created_at.isoformat() if inv.created_at else ""
        })
    return result

@router.post("/invoices")
def create_invoice(data: InvoiceCreate, user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    d_date = datetime.datetime.strptime(data.due_date, "%Y-%m-%d").date() if data.due_date else None
    inv = Invoice(
        company_id=_cid(user),
        invoice_number=_gen_order_number("INV"),
        customer_id=data.customer_id,
        total_amount=data.total_amount,
        due_date=d_date,
        status="unpaid"
    )
    db.add(inv); db.commit(); db.refresh(inv)
    return inv

@router.patch("/invoices/{inv_id}/status")
def update_invoice_status(inv_id: int, status: str = Query(...), user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    inv = db.query(Invoice).filter(Invoice.id == inv_id, Invoice.company_id == _cid(user)).first()
    if not inv: raise HTTPException(404, "Not found")
    inv.status = status
    if status == "paid":
        inv.paid_amount = inv.total_amount
    db.commit()
    return {"ok": True}

@router.delete("/invoices/{inv_id}")
def delete_invoice(inv_id: int, user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    inv = db.query(Invoice).filter(Invoice.id == inv_id, Invoice.company_id == _cid(user)).first()
    if not inv: raise HTTPException(404, "Not found")
    db.delete(inv); db.commit()
    return {"ok": True}

# ──────────────────────────── Employees (Company-scoped) ────────────────────────────

@router.get("/employees")
def list_employees(user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(Employee).filter(Employee.company_id == _cid(user)).all()

@router.delete("/employees/{emp_id}")
def delete_employee(emp_id: int, user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    emp = db.query(Employee).filter(Employee.id == emp_id, Employee.company_id == _cid(user)).first()
    if not emp: raise HTTPException(404, "Not found")
    db.delete(emp); db.commit()
    return {"ok": True}

# ──────────────────────────── Attendance ────────────────────────────

class AttendanceCreate(BaseModel):
    employee_id: int
    date: Optional[str] = None
    status: str = "present"
    check_in: Optional[str] = None
    check_out: Optional[str] = None

@router.get("/attendance")
def list_attendance(user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    cid = _cid(user)
    rows = (
        db.query(Attendance, Employee.employee_name, Employee.department, Employee.designation)
        .outerjoin(Employee, Attendance.employee_id == Employee.id)
        .filter(Attendance.company_id == cid)
        .order_by(Attendance.date.desc(), Attendance.id.desc())
        .limit(200)
        .all()
    )
    result = []
    for att, emp_name, dept, desig in rows:
        result.append({
            "id": att.id,
            "company_id": att.company_id,
            "employee_id": att.employee_id,
            "employee_name": emp_name or f"Employee #{att.employee_id}",
            "department": dept or "General",
            "designation": desig or "Staff",
            "date": str(att.date) if att.date else "",
            "check_in": att.check_in.strftime("%I:%M %p") if att.check_in else None,
            "check_out": att.check_out.strftime("%I:%M %p") if att.check_out else None,
            "status": att.status,
        })
    return result

@router.get("/attendance/today-status")
def get_today_attendance_status(user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    cid = _cid(user)
    today = datetime.date.today()
    
    user_emp_id = user.get("employee_id")
    my_record = None
    if user_emp_id:
        rec = db.query(Attendance).filter(
            Attendance.company_id == cid,
            Attendance.employee_id == user_emp_id,
            Attendance.date == today
        ).first()
        if rec:
            my_record = {
                "id": rec.id,
                "status": rec.status,
                "check_in": rec.check_in.strftime("%I:%M %p") if rec.check_in else None,
                "check_out": rec.check_out.strftime("%I:%M %p") if rec.check_out else None,
            }
            
    present_count = db.query(sqlfunc.count(Attendance.id)).filter(
        Attendance.company_id == cid, Attendance.date == today, Attendance.status == "present"
    ).scalar() or 0
    late_count = db.query(sqlfunc.count(Attendance.id)).filter(
        Attendance.company_id == cid, Attendance.date == today, Attendance.status == "late"
    ).scalar() or 0
    absent_count = db.query(sqlfunc.count(Attendance.id)).filter(
        Attendance.company_id == cid, Attendance.date == today, Attendance.status == "absent"
    ).scalar() or 0
    leave_count = db.query(sqlfunc.count(Attendance.id)).filter(
        Attendance.company_id == cid, Attendance.date == today, Attendance.status == "leave"
    ).scalar() or 0
    total_emp = db.query(sqlfunc.count(Employee.id)).filter(Employee.company_id == cid).scalar() or 0

    return {
        "date": str(today),
        "user_name": user.get("employee_name") or "User",
        "my_status": my_record,
        "summary": {
            "total_employees": total_emp,
            "present": present_count,
            "late": late_count,
            "absent": absent_count,
            "leave": leave_count,
        }
    }

@router.post("/attendance/check-in")
def check_in_employee(user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    cid = _cid(user)
    emp_id = user.get("employee_id")
    if not emp_id:
        first_emp = db.query(Employee).filter(Employee.company_id == cid).first()
        if not first_emp:
            raise HTTPException(400, "No employee record found for check-in")
        emp_id = first_emp.id

    today = datetime.date.today()
    now = datetime.datetime.now(datetime.timezone.utc)

    att = db.query(Attendance).filter(
        Attendance.company_id == cid,
        Attendance.employee_id == emp_id,
        Attendance.date == today
    ).first()

    if not att:
        att = Attendance(
            company_id=cid,
            employee_id=emp_id,
            date=today,
            check_in=now,
            status="present"
        )
        db.add(att)
    else:
        if not att.check_in:
            att.check_in = now
        att.status = "present"

    db.commit()
    db.refresh(att)
    return {
        "ok": True,
        "message": f"Checked in at {now.strftime('%I:%M %p')}",
        "check_in": now.strftime("%I:%M %p"),
        "status": att.status
    }

@router.post("/attendance/check-out")
def check_out_employee(user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    cid = _cid(user)
    emp_id = user.get("employee_id")
    if not emp_id:
        first_emp = db.query(Employee).filter(Employee.company_id == cid).first()
        if not first_emp:
            raise HTTPException(400, "No employee record found for check-out")
        emp_id = first_emp.id

    today = datetime.date.today()
    now = datetime.datetime.now(datetime.timezone.utc)

    att = db.query(Attendance).filter(
        Attendance.company_id == cid,
        Attendance.employee_id == emp_id,
        Attendance.date == today
    ).first()

    if not att:
        att = Attendance(
            company_id=cid,
            employee_id=emp_id,
            date=today,
            check_in=now,
            check_out=now,
            status="present"
        )
        db.add(att)
    else:
        att.check_out = now

    db.commit()
    db.refresh(att)
    return {
        "ok": True,
        "message": f"Checked out at {now.strftime('%I:%M %p')}",
        "check_out": now.strftime("%I:%M %p"),
        "status": att.status
    }

@router.post("/attendance")
def create_attendance(data: AttendanceCreate, user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    cid = _cid(user)
    att_date = datetime.datetime.strptime(data.date, "%Y-%m-%d").date() if data.date else datetime.date.today()
    
    existing = db.query(Attendance).filter(
        Attendance.company_id == cid,
        Attendance.employee_id == data.employee_id,
        Attendance.date == att_date
    ).first()

    if existing:
        existing.status = data.status
        db.commit()
        db.refresh(existing)
        return existing

    now = datetime.datetime.now(datetime.timezone.utc)
    att = Attendance(
        company_id=cid,
        employee_id=data.employee_id,
        date=att_date,
        check_in=now if data.status == "present" else None,
        status=data.status
    )
    db.add(att); db.commit(); db.refresh(att)
    return att

@router.delete("/attendance/{att_id}")
def delete_attendance(att_id: int, user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    att = db.query(Attendance).filter(Attendance.id == att_id, Attendance.company_id == _cid(user)).first()
    if not att: raise HTTPException(404, "Not found")
    db.delete(att); db.commit()
    return {"ok": True}

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

@router.patch("/projects/{proj_id}/status")
def update_project_status(proj_id: int, status: str = Query(...), user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    p = db.query(Project).filter(Project.id == proj_id, Project.company_id == _cid(user)).first()
    if not p: raise HTTPException(404, "Not found")
    p.status = status
    db.commit()
    return {"ok": True}

@router.delete("/projects/{proj_id}")
def delete_project(proj_id: int, user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    p = db.query(Project).filter(Project.id == proj_id, Project.company_id == _cid(user)).first()
    if not p: raise HTTPException(404, "Not found")
    db.delete(p); db.commit()
    return {"ok": True}

# ──────────────────────────── Tasks ────────────────────────────

class TaskCreate(BaseModel):
    title: str
    description: str = ""
    priority: str = "medium"
    project_id: Optional[int] = None
    assigned_to: Optional[int] = None

@router.get("/tasks")
def list_tasks(user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    cid = _cid(user)
    rows = (
        db.query(Task, Employee.employee_name, Project.name.label("project_name"))
        .outerjoin(Employee, Task.assigned_to == Employee.id)
        .outerjoin(Project, Task.project_id == Project.id)
        .filter(Task.company_id == cid)
        .order_by(Task.created_at.desc())
        .all()
    )
    result = []
    for t, emp_name, proj_name in rows:
        result.append({
            "id": t.id,
            "company_id": t.company_id,
            "title": t.title,
            "description": t.description,
            "priority": t.priority,
            "status": t.status,
            "project_id": t.project_id,
            "project_name": proj_name or "General",
            "assigned_to": t.assigned_to,
            "assigned_name": emp_name or "Unassigned",
            "created_at": t.created_at.isoformat() if t.created_at else ""
        })
    return result

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

@router.delete("/tasks/{task_id}")
def delete_task(task_id: int, user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    t = db.query(Task).filter(Task.id == task_id, Task.company_id == _cid(user)).first()
    if not t: raise HTTPException(404, "Not found")
    db.delete(t); db.commit()
    return {"ok": True}

# ──────────────────────────── Notifications ────────────────────────────

@router.get("/notifications")
def list_notifications(user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(Notification).filter(
        Notification.company_id == _cid(user)
    ).order_by(Notification.created_at.desc()).limit(50).all()

@router.patch("/notifications/{notif_id}/read")
def mark_notification_read(notif_id: int, user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    n = db.query(Notification).filter(Notification.id == notif_id, Notification.company_id == _cid(user)).first()
    if not n: raise HTTPException(404, "Not found")
    n.is_read = True
    db.commit()
    return {"ok": True}

@router.delete("/notifications/{notif_id}")
def delete_notification(notif_id: int, user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    n = db.query(Notification).filter(Notification.id == notif_id, Notification.company_id == _cid(user)).first()
    if not n: raise HTTPException(404, "Not found")
    db.delete(n); db.commit()
    return {"ok": True}

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

@router.delete("/departments/{dept_id}")
def delete_department(dept_id: int, user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    d = db.query(Department).filter(Department.id == dept_id, Department.company_id == _cid(user)).first()
    if not d: raise HTTPException(404, "Not found")
    db.delete(d); db.commit()
    return {"ok": True}

# ──────────────────────────── Leaves ────────────────────────────

class LeaveCreate(BaseModel):
    employee_id: int
    leave_type: str
    start_date: str
    end_date: str
    reason: str = ""

@router.get("/leaves")
def list_leaves(user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    cid = _cid(user)
    rows = (
        db.query(LeaveRequest, Employee.employee_name)
        .outerjoin(Employee, LeaveRequest.employee_id == Employee.id)
        .filter(LeaveRequest.company_id == cid)
        .order_by(LeaveRequest.created_at.desc())
        .all()
    )
    result = []
    for req, emp_name in rows:
        result.append({
            "id": req.id,
            "company_id": req.company_id,
            "employee_id": req.employee_id,
            "employee_name": emp_name or f"Employee #{req.employee_id}",
            "leave_type": req.leave_type,
            "start_date": str(req.start_date),
            "end_date": str(req.end_date),
            "reason": req.reason,
            "status": req.status,
            "created_at": req.created_at.isoformat() if req.created_at else ""
        })
    return result

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

@router.delete("/leaves/{leave_id}")
def delete_leave(leave_id: int, user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    req = db.query(LeaveRequest).filter(LeaveRequest.id == leave_id, LeaveRequest.company_id == _cid(user)).first()
    if not req: raise HTTPException(404, "Not found")
    db.delete(req); db.commit()
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
    cid = _cid(user)
    rows = (
        db.query(Payroll, Employee.employee_name)
        .outerjoin(Employee, Payroll.employee_id == Employee.id)
        .filter(Payroll.company_id == cid)
        .order_by(Payroll.created_at.desc())
        .all()
    )
    result = []
    for pay, emp_name in rows:
        result.append({
            "id": pay.id,
            "company_id": pay.company_id,
            "employee_id": pay.employee_id,
            "employee_name": emp_name or f"Employee #{pay.employee_id}",
            "month": pay.month,
            "basic_salary": pay.basic_salary,
            "allowances": pay.allowances,
            "deductions": pay.deductions,
            "net_salary": pay.net_salary,
            "status": pay.status,
            "created_at": pay.created_at.isoformat() if pay.created_at else ""
        })
    return result

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
        status="processed"
    )
    db.add(pay); db.commit(); db.refresh(pay)
    return pay

@router.patch("/payroll/{pay_id}/status")
def update_payroll_status(pay_id: int, status: str = Query(...), user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    pay = db.query(Payroll).filter(Payroll.id == pay_id, Payroll.company_id == _cid(user)).first()
    if not pay: raise HTTPException(404, "Not found")
    pay.status = status
    db.commit()
    return {"ok": True}

@router.delete("/payroll/{pay_id}")
def delete_payroll(pay_id: int, user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    pay = db.query(Payroll).filter(Payroll.id == pay_id, Payroll.company_id == _cid(user)).first()
    if not pay: raise HTTPException(404, "Not found")
    db.delete(pay); db.commit()
    return {"ok": True}

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
    role = user.get("role", "company_admin") if isinstance(user, dict) else "company_admin"
    provider = get_ai_voice_provider()
    return provider.process_command(transcript=data.transcript, company_id=cid, db=db, user_role=role)


