from sqlalchemy.orm import Session

from app.models.erp import AuditLog


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
        action=action,
        resource=resource,
        details=details,
        ip_address=ip_address,
    )
    db.add(entry)
    return entry
