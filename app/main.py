import logging
from fastapi import FastAPI
from app.api.auth import router as auth_router
from app.api.accounts import router as accounts_router
from app.api.transactions import router as transactions_router

# Configure structured logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)

app = FastAPI(title="High-Throughput Transaction Pipeline")

app.include_router(auth_router)
app.include_router(accounts_router)
app.include_router(transactions_router)

@app.get("/")
def read_root():
    return {"status": "ok", "message": "Transaction Pipeline API is running"}
