from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.auth import router as auth_router
from app.api.companies import router as companies_router
from app.api.employees import router as employees_router
from app.api.erp import router as erp_router

from app.db.database import engine
from app.models.base import Base
import app.models  # Ensures all models are registered with Base

app = FastAPI(
    title="AI Voice ERP API",
    description="Production-ready Multi-Tenant Voice ERP",
    version="1.0.0",
)

@app.on_event("startup")
def startup_db_client():
    """Ensure database tables exist on server startup."""
    try:
        Base.metadata.create_all(bind=engine)
    except Exception as e:
        print(f"Warning: Database create_all encountered: {e}")

app.add_middleware(
    CORSMiddleware,
    # The PWA and API share an origin in production. Avoid wildcard credential
    # CORS, which browsers reject and which would expose authenticated requests.
    allow_origins=["http://localhost:3000", "http://localhost:8000"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/api/auth", tags=["Authentication"])
app.include_router(companies_router, prefix="/api/companies", tags=["Companies"])
app.include_router(employees_router, prefix="/api/employees", tags=["Employees"])
app.include_router(erp_router, prefix="/api/erp", tags=["ERP Modules"])


@app.get("/")
def read_root():
    return {"message": "AI Voice ERP API v1.0"}

