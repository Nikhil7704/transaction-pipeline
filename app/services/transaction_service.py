import logging
from sqlalchemy.orm import Session
from fastapi import HTTPException
from app.models.account import Account
from app.models.transaction import Transaction, TransactionStatus
from app.models.ledger import LedgerEntry
import decimal
import time

logger = logging.getLogger(__name__)

# Maximum allowed transfer amount
MAX_TRANSFER_AMOUNT = decimal.Decimal("10000000.00")  # 1 crore

def process_transfer(db: Session, source_id: int, destination_id: int, amount: decimal.Decimal, idempotency_key: str):
    if source_id == destination_id:
        raise HTTPException(status_code=400, detail="Cannot transfer to the same account")

    if amount > MAX_TRANSFER_AMOUNT:
        raise HTTPException(status_code=400, detail=f"Transfer amount exceeds maximum limit of {MAX_TRANSFER_AMOUNT}")

    # Check idempotency in DB
    if idempotency_key:
        existing_tx = db.query(Transaction).filter(Transaction.idempotency_key == idempotency_key).first()
        if existing_tx:
            logger.info(
                "idempotent_request_returned",
                extra={
                    "transaction_id": existing_tx.id,
                    "idempotency_key": idempotency_key,
                }
            )
            return existing_tx

    # Deterministic ordering to prevent deadlocks
    first_id = min(source_id, destination_id)
    second_id = max(source_id, destination_id)

    start_time = time.time()

    try:
        # Acquire row-level locks in deterministic order
        accounts = db.query(Account).filter(
            Account.id.in_([first_id, second_id])
        ).order_by(Account.id).with_for_update().all()

        accounts_dict = {acc.id: acc for acc in accounts}

        source = accounts_dict.get(source_id)
        destination = accounts_dict.get(destination_id)

        if not source:
            raise HTTPException(status_code=404, detail="Source account not found")
        if not destination:
            raise HTTPException(status_code=404, detail="Destination account not found")

        # Check balance
        if source.balance < amount:
            raise HTTPException(status_code=400, detail="Insufficient balance")

        # Perform debit and credit
        source.balance -= amount
        destination.balance += amount

        # Create Transaction record
        transaction = Transaction(
            source_account_id=source_id,
            destination_account_id=destination_id,
            amount=amount,
            status=TransactionStatus.COMPLETED.value,
            idempotency_key=idempotency_key
        )
        db.add(transaction)
        db.flush()  # To get transaction.id for ledger entries

        # Create Ledger Entries
        debit_entry = LedgerEntry(
            transaction_id=transaction.id,
            account_id=source_id,
            entry_type="DEBIT",
            amount=amount
        )
        credit_entry = LedgerEntry(
            transaction_id=transaction.id,
            account_id=destination_id,
            entry_type="CREDIT",
            amount=amount
        )
        db.add(debit_entry)
        db.add(credit_entry)

        # Commit everything
        db.commit()

        latency_ms = round((time.time() - start_time) * 1000, 2)
        logger.info(
            "transaction_completed",
            extra={
                "transaction_id": transaction.id,
                "source_account": source_id,
                "destination_account": destination_id,
                "amount": str(amount),
                "latency_ms": latency_ms,
            }
        )

        return transaction

    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        logger.error("transaction_failed", extra={"error": str(e), "source": source_id, "destination": destination_id})
        raise HTTPException(status_code=500, detail="Transaction failed due to internal error")
