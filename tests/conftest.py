import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import os

from app.main import app
from app.db.database import Base, get_db

TEST_DATABASE_URL = os.getenv("TEST_DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/transaction_pipeline_test")

engine = create_engine(TEST_DATABASE_URL)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="session")
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)

@pytest.fixture(scope="function")
def db_session(setup_db):
    connection = engine.connect()
    transaction = connection.begin()
    session = TestingSessionLocal(bind=connection)

    yield session

    session.close()
    transaction.rollback()
    connection.close()

@pytest.fixture(scope="function")
def client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c

@pytest.fixture
def auth_token(client):
    client.post("/auth/register", json={"email": "accuser@example.com", "password": "pass"})
    res = client.post("/auth/login", json={"email": "accuser@example.com", "password": "pass"})
    return res.json()["access_token"]

@pytest.fixture
def test_users(client):
    client.post("/auth/register", json={"email": "userA@example.com", "password": "123"})
    client.post("/auth/register", json={"email": "userB@example.com", "password": "123"})

    tokenA = client.post("/auth/login", json={"email": "userA@example.com", "password": "123"}).json()["access_token"]
    tokenB = client.post("/auth/login", json={"email": "userB@example.com", "password": "123"}).json()["access_token"]

    accA = client.post("/accounts", json={"currency": "INR"}, headers={"Authorization": f"Bearer {tokenA}"}).json()
    accB = client.post("/accounts", json={"currency": "INR"}, headers={"Authorization": f"Bearer {tokenB}"}).json()

    return {"tokenA": tokenA, "tokenB": tokenB, "accA": accA["id"], "accB": accB["id"]}
