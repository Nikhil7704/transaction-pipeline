from pydantic import BaseModel, Field
from decimal import Decimal
from datetime import datetime

class TransferRequest(BaseModel):
    source_account_id: int
    destination_account_id: int
    amount: Decimal = Field(gt=0, le=10000000, description="Transfer amount must be positive and within limit")

class TransferResponse(BaseModel):
    transaction_id: int
    status: str
    amount: Decimal

    class Config:
        from_attributes = True

class TransactionHistoryResponse(BaseModel):
    transaction_id: int
    source_account_id: int
    destination_account_id: int
    amount: Decimal
    status: str
    created_at: datetime

    class Config:
        from_attributes = True
