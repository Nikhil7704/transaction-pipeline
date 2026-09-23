from pydantic import BaseModel
from decimal import Decimal

class AccountCreate(BaseModel):
    currency: str = "INR"

class AccountResponse(BaseModel):
    id: int
    balance: Decimal
    currency: str

    class Config:
        from_attributes = True

class AccountBalanceResponse(BaseModel):
    account_id: int
    balance: Decimal
    currency: str
