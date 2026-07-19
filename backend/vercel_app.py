"""Vercel ASGI entry point.

Keep the backend directory on the import path explicitly. This makes the API
available whether Vercel loads this file from the project root or directly
from the backend directory.
"""
from pathlib import Path
import sys

backend_dir = str(Path(__file__).resolve().parent)
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.main import app

# Vercel requires the FastAPI instance to be available at the module level.
# It will look for the 'app' variable in this file.
