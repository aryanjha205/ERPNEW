from sqlalchemy.orm import Session

from app.models.erp import AuditLog


def _clip(value: str | None, limit: int = 20) -> str | None:
    if value is None:
        return None
    return value[:limit]


def record_audit_event(
    db: Session,
    action: str,
    resource: str | None = None,
    details: str = "",
    company_id: int | None = None,
    user_subject: str | None = None,
    ip_address: str | None = None,
) -> AuditLog:
    """Stage an audit event in the current transaction."""
    entry = AuditLog(
        company_id=company_id,
        user_subject=user_subject,
        action=_clip(action) or action,
        resource=_clip(resource),
        details=details,
        ip_address=ip_address,
    )
    db.add(entry)
    return entry
