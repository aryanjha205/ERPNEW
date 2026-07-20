"""
Company Type Templates Configuration Engine.

Automatically configures active ERP modules, default settings, workflow flags,
and AI voice shortcuts based on the industry template selected during registration.
"""
from typing import Dict, List, Any

COMPANY_TYPES: List[str] = [
    "Manufacturing",
    "Chemical Industry",
    "Pharmaceutical",
    "Retail",
    "Wholesale",
    "Trading",
    "Construction",
    "Hospital",
    "School",
    "College",
    "Restaurant",
    "Hotel",
    "Logistics",
    "Warehouse",
    "Agriculture",
    "Textile",
    "Automobile",
    "Electronics",
    "IT Company",
    "Service Business",
    "Custom Business",
]

TEMPLATE_MODULE_CONFIGS: Dict[str, Dict[str, Any]] = {
    "Manufacturing": {
        "modules": ["Dashboard", "Employees", "Departments", "Attendance", "Leaves", "Payroll", "Suppliers", "Inventory", "Sales", "Purchases", "Invoices", "Projects", "Tasks", "Notifications", "Reports", "Settings"],
        "primary_focus": "Production, Work Orders & Supply Chain",
        "default_warehouse": "Factory Floor Warehouse",
    },
    "Chemical Industry": {
        "modules": ["Dashboard", "Employees", "Departments", "Attendance", "Leaves", "Payroll", "Suppliers", "Inventory", "Sales", "Purchases", "Invoices", "Notifications", "Reports", "Settings"],
        "primary_focus": "Batch Production & Hazmat Inventory",
        "default_warehouse": "Chemical Storage Bay",
    },
    "Pharmaceutical": {
        "modules": ["Dashboard", "Employees", "Departments", "Attendance", "Leaves", "Payroll", "Suppliers", "Inventory", "Sales", "Purchases", "Invoices", "Notifications", "Reports", "Settings"],
        "primary_focus": "Expiry Tracking & Regulatory Compliance",
        "default_warehouse": "Pharma Vault",
    },
    "Retail": {
        "modules": ["Dashboard", "Employees", "Attendance", "Customers", "Inventory", "Sales", "Invoices", "Notifications", "Reports", "Settings"],
        "primary_focus": "Point of Sale & Fast Inventory Turnover",
        "default_warehouse": "Retail Store Storefront",
    },
    "Wholesale": {
        "modules": ["Dashboard", "Employees", "Customers", "Suppliers", "Inventory", "Sales", "Purchases", "Invoices", "Notifications", "Reports", "Settings"],
        "primary_focus": "Bulk Ordering & Tiered Pricing",
        "default_warehouse": "Central Fulfillment Warehouse",
    },
    "Trading": {
        "modules": ["Dashboard", "Employees", "Customers", "Suppliers", "Inventory", "Sales", "Purchases", "Invoices", "Notifications", "Reports", "Settings"],
        "primary_focus": "Imports, Exports & Vendor Margins",
        "default_warehouse": "Trade Logistics Center",
    },
    "Construction": {
        "modules": ["Dashboard", "Employees", "Departments", "Attendance", "Payroll", "Suppliers", "Inventory", "Purchases", "Projects", "Tasks", "Notifications", "Reports", "Settings"],
        "primary_focus": "Site Projects, Milestones & Equipment Tracking",
        "default_warehouse": "Site Material Yard",
    },
    "Hospital": {
        "modules": ["Dashboard", "Employees", "Departments", "Attendance", "Leaves", "Payroll", "Customers", "Suppliers", "Inventory", "Tasks", "Notifications", "Reports", "Settings"],
        "primary_focus": "Patient Records, Duty Roster & Medical Supplies",
        "default_warehouse": "Hospital Pharmacy Depot",
    },
    "School": {
        "modules": ["Dashboard", "Employees", "Departments", "Attendance", "Leaves", "Payroll", "Customers", "Notifications", "Reports", "Settings"],
        "primary_focus": "Faculty, Attendance & Student Billing",
        "default_warehouse": "Campus Supply Room",
    },
    "College": {
        "modules": ["Dashboard", "Employees", "Departments", "Attendance", "Leaves", "Payroll", "Customers", "Projects", "Tasks", "Notifications", "Reports", "Settings"],
        "primary_focus": "Departmental Research & Grants Management",
        "default_warehouse": "University Store",
    },
    "Restaurant": {
        "modules": ["Dashboard", "Employees", "Attendance", "Payroll", "Suppliers", "Inventory", "Sales", "Purchases", "Notifications", "Reports", "Settings"],
        "primary_focus": "Perishable Inventory & Daily Kitchen Sales",
        "default_warehouse": "Cold Storage & Pantry",
    },
    "Hotel": {
        "modules": ["Dashboard", "Employees", "Departments", "Attendance", "Payroll", "Customers", "Suppliers", "Inventory", "Sales", "Tasks", "Notifications", "Reports", "Settings"],
        "primary_focus": "Room Management, Housekeeping Tasks & Concierge",
        "default_warehouse": "Hotel Operations Store",
    },
    "Logistics": {
        "modules": ["Dashboard", "Employees", "Attendance", "Customers", "Suppliers", "Inventory", "Sales", "Purchases", "Invoices", "Tasks", "Notifications", "Reports", "Settings"],
        "primary_focus": "Shipment Tracking & Fleet Maintenance",
        "default_warehouse": "Transit Hub",
    },
    "Warehouse": {
        "modules": ["Dashboard", "Employees", "Attendance", "Suppliers", "Inventory", "Purchases", "Tasks", "Notifications", "Reports", "Settings"],
        "primary_focus": "Stock Movements & Bin Location Management",
        "default_warehouse": "Main Distribution Center",
    },
    "Agriculture": {
        "modules": ["Dashboard", "Employees", "Attendance", "Suppliers", "Inventory", "Sales", "Purchases", "Notifications", "Reports", "Settings"],
        "primary_focus": "Crop Yields & Seasonal Supply Procurement",
        "default_warehouse": "Farm Storage Silo",
    },
    "Textile": {
        "modules": ["Dashboard", "Employees", "Departments", "Attendance", "Payroll", "Suppliers", "Inventory", "Sales", "Purchases", "Invoices", "Notifications", "Reports", "Settings"],
        "primary_focus": "Fabric Rolls, Dyes & Garment Batch Orders",
        "default_warehouse": "Textile Mill Depot",
    },
    "Automobile": {
        "modules": ["Dashboard", "Employees", "Departments", "Attendance", "Payroll", "Customers", "Suppliers", "Inventory", "Sales", "Purchases", "Invoices", "Projects", "Tasks", "Notifications", "Reports", "Settings"],
        "primary_focus": "Vehicle Assembly, Spare Parts & Service Jobs",
        "default_warehouse": "Auto Parts Depot",
    },
    "Electronics": {
        "modules": ["Dashboard", "Employees", "Departments", "Attendance", "Payroll", "Customers", "Suppliers", "Inventory", "Sales", "Purchases", "Invoices", "Notifications", "Reports", "Settings"],
        "primary_focus": "Serial Number Tracking & Warranty Logistics",
        "default_warehouse": "Electronics Hub",
    },
    "IT Company": {
        "modules": ["Dashboard", "Employees", "Departments", "Attendance", "Leaves", "Payroll", "Customers", "Invoices", "Projects", "Tasks", "Notifications", "Reports", "Settings"],
        "primary_focus": "Sprint Tracking, Client Billing & Team Projects",
        "default_warehouse": "IT Hardware Locker",
    },
    "Service Business": {
        "modules": ["Dashboard", "Employees", "Departments", "Attendance", "Leaves", "Payroll", "Customers", "Sales", "Invoices", "Projects", "Tasks", "Notifications", "Reports", "Settings"],
        "primary_focus": "Client Contracts & Professional Services",
        "default_warehouse": "Main Storage",
    },
    "Custom Business": {
        "modules": ["Dashboard", "Employees", "Departments", "Attendance", "Leaves", "Payroll", "Customers", "Suppliers", "Inventory", "Sales", "Purchases", "Invoices", "Projects", "Tasks", "Notifications", "Reports", "Settings"],
        "primary_focus": "Full Enterprise Suite",
        "default_warehouse": "Main Warehouse",
    },
}

def get_company_type_config(company_type: str) -> Dict[str, Any]:
    """Return configuration dict for given company type template."""
    return TEMPLATE_MODULE_CONFIGS.get(company_type, TEMPLATE_MODULE_CONFIGS["Custom Business"])
