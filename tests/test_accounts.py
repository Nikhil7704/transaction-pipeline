import pytest

@pytest.fixture
def auth_token(client):
    client.post("/auth/register", json={"email": "accuser@example.com", "password": "pass"})
    res = client.post("/auth/login", json={"email": "accuser@example.com", "password": "pass"})
    return res.json()["access_token"]

def test_create_account(client, auth_token):
    response = client.post(
        "/accounts",
        json={"currency": "INR"},
        headers={"Authorization": f"Bearer {auth_token}"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["balance"] == "0.00"
    assert data["currency"] == "INR"
    assert "id" in data

def test_get_account_balance(client, auth_token):
    # Create account
    create_res = client.post(
        "/accounts",
        json={"currency": "USD"},
        headers={"Authorization": f"Bearer {auth_token}"}
    )
    acc_id = create_res.json()["id"]

    # Get balance
    bal_res = client.get(
        f"/accounts/{acc_id}/balance",
        headers={"Authorization": f"Bearer {auth_token}"}
    )
    assert bal_res.status_code == 200
    assert bal_res.json()["balance"] == "0.00"
    assert bal_res.json()["currency"] == "USD"
