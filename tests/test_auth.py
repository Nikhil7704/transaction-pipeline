def test_register_user(client):
    response = client.post(
        "/auth/register",
        json={"email": "testuser@example.com", "password": "password123"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "testuser@example.com"
    assert "id" in data

def test_register_existing_user(client):
    # First registration
    client.post("/auth/register", json={"email": "duplicate@example.com", "password": "pass"})
    # Second registration
    response = client.post("/auth/register", json={"email": "duplicate@example.com", "password": "pass"})
    assert response.status_code == 400
    assert response.json()["detail"] == "Email already registered"

def test_login_user(client):
    client.post("/auth/register", json={"email": "login@example.com", "password": "password123"})
    
    response = client.post(
        "/auth/login",
        json={"email": "login@example.com", "password": "password123"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"

def test_login_wrong_password(client):
    client.post("/auth/register", json={"email": "wrongpass@example.com", "password": "password123"})
    
    response = client.post(
        "/auth/login",
        json={"email": "wrongpass@example.com", "password": "wrong"}
    )
    assert response.status_code == 401
