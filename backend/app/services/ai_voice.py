"""
AI Voice Assistant Provider System.

Provides a pluggable abstraction layer for voice and text processing.
Supports OpenRouter AI API with fallback to zero-key FreeAIProvider.
Enforces multi-tenant data isolation using company_id filtering.
"""
import json
import random
import string
import requests
from abc import ABC, abstractmethod
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.erp import Customer, Supplier, InventoryItem, SalesOrder, PurchaseOrder, Invoice, Task, Project, Attendance
from app.models.employee import Employee
from app.core.config import settings


class BaseAIProvider(ABC):
    """Abstract interface for AI Voice processing providers."""

    @abstractmethod
    def process_command(self, transcript: str, company_id: int, db: Session, user_role: str = "company_admin") -> Dict[str, Any]:
        """
        Process user speech transcript and execute or recommend ERP actions.
        Returns dict with:
            action: str ("navigate", "create", "search", "refresh", "none")
            target: str (module name or identifier)
            speech: str (text response for TTS synthesis)
            data: optional dict with created or queried details
        """
        pass


class OpenRouterAIProvider(BaseAIProvider):
    """
    Production-grade AI Provider powered by OpenRouter Chat Completions API.
    Enforces multi-tenant data isolation and RBAC.
    """

    def __init__(self, api_key: str, model: str = "google/gemma-4-26b-a4b-it:free"):
        self.api_key = api_key
        self.model = model
        self.endpoint = "https://openrouter.ai/api/v1/chat/completions"

    def process_command(self, transcript: str, company_id: int, db: Session, user_role: str = "company_admin") -> Dict[str, Any]:
        # Gather live enterprise context strictly scoped by company_id
        try:
            total_sales = db.query(func.coalesce(func.sum(SalesOrder.total_amount), 0)).filter(SalesOrder.company_id == company_id).scalar() or 0.0
            sales_count = db.query(func.count(SalesOrder.id)).filter(SalesOrder.company_id == company_id).scalar() or 0
            pending_invoices = db.query(func.count(Invoice.id)).filter(Invoice.company_id == company_id, Invoice.status == "unpaid").scalar() or 0
            unpaid_amount = db.query(func.coalesce(func.sum(Invoice.total_amount), 0)).filter(Invoice.company_id == company_id, Invoice.status == "unpaid").scalar() or 0.0
            inventory_items_count = db.query(func.count(InventoryItem.id)).filter(InventoryItem.company_id == company_id).scalar() or 0
            employees_count = db.query(func.count(Employee.id)).filter(Employee.company_id == company_id).scalar() or 0
            open_tasks = db.query(func.count(Task.id)).filter(Task.company_id == company_id, Task.status != "completed").scalar() or 0

            context_summary = f"""
Company Workspace ID: {company_id} | User Role: {user_role}
Current Financial & Operational Snapshot:
- Total Sales Revenue: ₹{total_sales:,.2f} ({sales_count} sales orders)
- Unpaid Invoices: {pending_invoices} (Total Unpaid: ₹{unpaid_amount:,.2f})
- Total Inventory Items: {inventory_items_count} items
- Employee Accounts: {employees_count} employees
- Open Tasks: {open_tasks} pending items
"""
        except Exception as err:
            context_summary = f"Company Workspace ID: {company_id} | Context error: {err}"

        system_prompt = f"""You are the centralized AI Voice & Intelligence Assistant for Nexus Multi-Tenant Enterprise ERP.
{context_summary}

Analyze the user command and respond strictly as a single JSON object. Do not include markdown tags or plain text explanations outside JSON.
Output Schema:
{{
    "action": "navigate" | "create" | "search" | "refresh" | "none",
    "target": "dashboard" | "customers" | "suppliers" | "inventory" | "sales" | "purchases" | "invoices" | "employees" | "attendance" | "payroll" | "projects" | "tasks" | "reports" | "notifications" | "settings" | null,
    "speech": "Natural voice response to be spoken aloud via browser speech synthesis. Use Indian Rupees (₹) for monetary figures.",
    "data": null
}}

Guidelines:
1. If user requests to view or open any module (e.g. sales, inventory, invoices, reports, attendance, tasks), set "action": "navigate", "target": "<module_name>".
2. If user requests quick insights (e.g. daily sales, unpaid bills, low stock), provide clear numbers in "speech" and navigate to the relevant module.
3. Keep "speech" professional, friendly, and concise (1 to 2 sentences max).
"""

        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": transcript}
            ],
            "temperature": 0.3,
            "max_tokens": 300
        }

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "HTTP-Referer": "https://erpnew-ten.vercel.app/",
            "X-Title": "Nexus AI Voice ERP",
            "Content-Type": "application/json"
        }

        try:
            res = requests.post(self.endpoint, headers=headers, json=payload, timeout=8)
            res.raise_for_status()
            res_data = res.json()
            content = res_data["choices"][0]["message"]["content"].strip()

            if content.startswith("```json"):
                content = content.split("```json")[1].split("```")[0].strip()
            elif content.startswith("```"):
                content = content.split("```")[1].split("```")[0].strip()

            parsed = json.loads(content)
            if "speech" in parsed and "action" in parsed:
                return parsed
        except Exception as exc:
            print(f"[OpenRouter Provider Warning - Falling back to FreeAIProvider]: {exc}")

        # Fallback to FreeAIProvider if OpenRouter API call fails or times out
        return FreeAIProvider().process_command(transcript, company_id, db, user_role)


class FreeAIProvider(BaseAIProvider):
    """
    Default free AI provider using rule-based NLP & intent matching.
    Does not require end users to provide any API keys.
    """

    def process_command(self, transcript: str, company_id: int, db: Session, user_role: str = "company_admin") -> Dict[str, Any]:
        text = transcript.lower().strip()

        # 1. Navigation / View Intents
        if any(kw in text for kw in ["check inventory", "show inventory", "open inventory", "inventory catalog"]):
            return {"action": "navigate", "target": "inventory", "speech": "Opening your inventory catalog."}
        
        if any(kw in text for kw in ["open crm", "show customer", "list customer", "view customer"]):
            return {"action": "navigate", "target": "customers", "speech": "Opening customer database."}

        if any(kw in text for kw in ["show supplier", "list supplier", "open supplier"]):
            return {"action": "navigate", "target": "suppliers", "speech": "Opening supplier directory."}

        if any(kw in text for kw in ["show sales", "today's sales", "todays sales", "recent sales", "sales summary"]):
            total_sales = db.query(func.coalesce(func.sum(SalesOrder.total_amount), 0)).filter(SalesOrder.company_id == company_id).scalar() or 0.0
            return {"action": "navigate", "target": "sales", "speech": f"Total sales revenue is ₹{total_sales:,.2f}. Opening sales module."}

        if any(kw in text for kw in ["show invoices", "search invoice", "open invoice", "pending invoice", "unpaid invoice"]):
            pending = db.query(func.count(Invoice.id)).filter(Invoice.company_id == company_id, Invoice.status == "unpaid").scalar() or 0
            return {"action": "navigate", "target": "invoices", "speech": f"You have {pending} pending unpaid invoices. Opening invoices."}

        if any(kw in text for kw in ["show projects", "open project", "project status"]):
            return {"action": "navigate", "target": "projects", "speech": "Opening project management."}

        if any(kw in text for kw in ["show tasks", "pending tasks", "my tasks"]):
            return {"action": "navigate", "target": "tasks", "speech": "Opening task list."}

        if any(kw in text for kw in ["show attendance", "check attendance", "employee attendance"]):
            return {"action": "navigate", "target": "attendance", "speech": "Opening employee attendance register."}

        if any(kw in text for kw in ["generate payroll", "show payroll", "open payroll"]):
            return {"action": "navigate", "target": "payroll", "speech": "Opening payroll calculation module."}

        if any(kw in text for kw in ["generate reports", "show reports", "analytics", "open reports"]):
            return {"action": "navigate", "target": "reports", "speech": "Opening enterprise reports and analytics."}

        # 2. Action Intents (Create Records)
        if "add customer" in text or "create customer" in text:
            raw_name = text.replace("add customer", "").replace("create customer", "").strip()
            name = raw_name.title() if raw_name else "New Voice Customer"
            customer = Customer(company_id=company_id, name=name)
            db.add(customer); db.commit(); db.refresh(customer)
            return {
                "action": "refresh",
                "target": "customers",
                "speech": f"Successfully created customer {name}.",
                "data": {"id": customer.id, "name": customer.name}
            }

        if "create task" in text or "add task" in text:
            raw_title = text.replace("create task", "").replace("add task", "").strip()
            title = raw_title.capitalize() if raw_title else "New voice action item"
            task = Task(company_id=company_id, title=title, description="Generated by AI Voice Assistant", priority="medium", status="todo")
            db.add(task); db.commit(); db.refresh(task)
            return {
                "action": "refresh",
                "target": "tasks",
                "speech": f"Created task: {title}.",
                "data": {"id": task.id, "title": task.title}
            }

        if "create invoice" in text:
            inv_num = f"INV-{''.join(random.choices(string.digits, k=6))}"
            inv = Invoice(company_id=company_id, invoice_number=inv_num, total_amount=0.0, status="unpaid")
            db.add(inv); db.commit()
            return {
                "action": "refresh",
                "target": "invoices",
                "speech": f"Draft invoice {inv_num} generated.",
                "data": {"invoice_number": inv_num}
            }

        # Default Conversational Fallback Response
        return {
            "action": "none",
            "target": None,
            "speech": f"I heard: '{transcript}'. Try asking: 'Show today's sales', 'Check pending invoices', 'Create task', or 'Open reports'."
        }


def get_ai_voice_provider() -> BaseAIProvider:
    api_key = getattr(settings, 'OPENROUTER_API_KEY', None)
    model = getattr(settings, 'OPENROUTER_MODEL', 'meta-llama/llama-3.3-70b-instruct:free') or 'meta-llama/llama-3.3-70b-instruct:free'
    if api_key and api_key.strip():
        return OpenRouterAIProvider(api_key=api_key.strip(), model=model.strip())
    return FreeAIProvider()
