import pytest
import asyncio
from httpx import AsyncClient
from app.models.account import Account

@pytest.mark.asyncio
async def test_concurrent_transfers(setup_db, test_users, db_session):
    """
    Fires 100 concurrent transfer requests from Account A to Account B.
    
    Account A starts with ₹100,000. Each request transfers ₹1,000.
    
    Expected result:
        - All 100 requests succeed
        - Account A balance = ₹0
        - Account B balance = ₹100,000
        - No negative balance, no lost update, no duplicate transaction
    """
    from app.main import app
    from app.db.database import get_db, SessionLocal

    # Seed Account A with ₹100,000 using a fresh session
    seed_db = SessionLocal()
    acc = seed_db.query(Account).filter(Account.id == test_users["accA"]).first()
    acc.balance = 100000.00
    seed_db.commit()
    seed_db.close()

    # Remove the test override so the app uses real DB sessions
    # (concurrency requires independent sessions per request)
    app.dependency_overrides.pop(get_db, None)

    headers = {"Authorization": f"Bearer {test_users['tokenA']}"}
    payload = {
        "source_account_id": test_users["accA"],
        "destination_account_id": test_users["accB"],
        "amount": "1000.00"
    }

    async with AsyncClient(app=app, base_url="http://test") as ac:
        tasks = [
            ac.post("/transactions/transfer", json=payload, headers=headers)
            for _ in range(100)
        ]
        responses = await asyncio.gather(*tasks)

    success_count = sum(1 for r in responses if r.status_code == 200)
    failed = [r.json() for r in responses if r.status_code != 200]

    # Verify final balances directly in DB
    verify_db = SessionLocal()
    accA = verify_db.query(Account).filter(Account.id == test_users["accA"]).first()
    accB = verify_db.query(Account).filter(Account.id == test_users["accB"]).first()
    final_A = accA.balance
    final_B = accB.balance
    verify_db.close()

    assert success_count == 100, f"Expected 100 successes, got {success_count}. Failures: {failed}"
    assert final_A == 0, f"Account A balance should be 0, got {final_A}"
    assert final_B == 100000, f"Account B balance should be 100000, got {final_B}"
