from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.user import User
from app.models.account import Account
from app.models.transaction import Transaction
from app.schemas.transaction import TransferRequest, TransferResponse, TransactionHistoryResponse
from app.core.dependencies import get_current_user
from app.services.transaction_service import process_transfer
from typing import Optional, List

router = APIRouter(prefix="/transactions", tags=["transactions"])

@router.post("/transfer", response_model=TransferResponse)
def transfer_money(
    request: TransferRequest,
    idempotency_key: Optional[str] = Header(None, alias="Idempotency-Key"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Authorization: Ensure source account belongs to the current user
    source_account = db.query(Account).filter(Account.id == request.source_account_id).first()
    if not source_account:
        raise HTTPException(status_code=404, detail="Source account not found")
    if source_account.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to transfer from this account")

    transaction = process_transfer(
        db=db,
        source_id=request.source_account_id,
        destination_id=request.destination_account_id,
        amount=request.amount,
        idempotency_key=idempotency_key
    )

    return {
        "transaction_id": transaction.id,
        "status": transaction.status,
        "amount": transaction.amount
    }

@router.get("/history", response_model=List[TransactionHistoryResponse])
def get_transaction_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Get all account IDs belonging to this user
    user_accounts = db.query(Account.id).filter(Account.user_id == current_user.id).all()
    account_ids = [a.id for a in user_accounts]

    if not account_ids:
        return []

    transactions = db.query(Transaction).filter(
        (Transaction.source_account_id.in_(account_ids)) |
        (Transaction.destination_account_id.in_(account_ids))
    ).order_by(Transaction.created_at.desc()).all()

    return [
        {
            "transaction_id": t.id,
            "source_account_id": t.source_account_id,
            "destination_account_id": t.destination_account_id,
            "amount": t.amount,
            "status": t.status,
            "created_at": t.created_at
        }
        for t in transactions
    ]

@router.get("/{transaction_id}", response_model=TransactionHistoryResponse)
def get_transaction(
    transaction_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    transaction = db.query(Transaction).filter(Transaction.id == transaction_id).first()
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")

    # Verify user owns either the source or destination account
    user_accounts = db.query(Account.id).filter(Account.user_id == current_user.id).all()
    account_ids = [a.id for a in user_accounts]

    if transaction.source_account_id not in account_ids and transaction.destination_account_id not in account_ids:
        raise HTTPException(status_code=403, detail="Not authorized to view this transaction")

    return {
        "transaction_id": transaction.id,
        "source_account_id": transaction.source_account_id,
        "destination_account_id": transaction.destination_account_id,
        "amount": transaction.amount,
        "status": transaction.status,
        "created_at": transaction.created_at
    }
