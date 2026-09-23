import pytest
from app.models.account import Account

def test_successful_transfer(client, db_session, test_users):
    # Give User A some money directly via DB
    acc = db_session.query(Account).filter(Account.id == test_users["accA"]).first()
    acc.balance = 5000
    db_session.commit()

    res = client.post(
        "/transactions/transfer",
        json={
            "source_account_id": test_users["accA"],
            "destination_account_id": test_users["accB"],
            "amount": "1500.00"
        },
        headers={"Authorization": f"Bearer {test_users['tokenA']}"}
    )
    
    assert res.status_code == 200
    data = res.json()
    assert data["amount"] == "1500.00"
    assert data["status"] == "COMPLETED"

    # Verify balances
    accA_bal = client.get(f"/accounts/{test_users['accA']}/balance", headers={"Authorization": f"Bearer {test_users['tokenA']}"}).json()["balance"]
    accB_bal = client.get(f"/accounts/{test_users['accB']}/balance", headers={"Authorization": f"Bearer {test_users['tokenB']}"}).json()["balance"]

    assert accA_bal == "3500.00"
    assert accB_bal == "1500.00"

def test_insufficient_balance(client, db_session, test_users):
    res = client.post(
        "/transactions/transfer",
        json={
            "source_account_id": test_users["accA"],
            "destination_account_id": test_users["accB"],
            "amount": "99999.00"
        },
        headers={"Authorization": f"Bearer {test_users['tokenA']}"}
    )
    
    assert res.status_code == 400
    assert "Insufficient balance" in res.json()["detail"]

def test_idempotent_transfer(client, db_session, test_users):
    # Add balance
    acc = db_session.query(Account).filter(Account.id == test_users["accA"]).first()
    acc.balance = 2000
    db_session.commit()

    headers = {
        "Authorization": f"Bearer {test_users['tokenA']}",
        "Idempotency-Key": "unique-key-123"
    }

    payload = {
        "source_account_id": test_users["accA"],
        "destination_account_id": test_users["accB"],
        "amount": "500.00"
    }

    # First request
    res1 = client.post("/transactions/transfer", json=payload, headers=headers)
    assert res1.status_code == 200

    # Second request with SAME key
    res2 = client.post("/transactions/transfer", json=payload, headers=headers)
    assert res2.status_code == 200
    assert res1.json()["transaction_id"] == res2.json()["transaction_id"]

    # Balance should only have decreased by 500 once
    accA_bal = client.get(f"/accounts/{test_users['accA']}/balance", headers={"Authorization": f"Bearer {test_users['tokenA']}"}).json()["balance"]
    assert accA_bal == "1500.00"
