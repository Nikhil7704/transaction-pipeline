"""
Seed script — creates 4 dummy users + accounts with ₹2000 each in Neon DB.
Run: .\venv\Scripts\python.exe seed.py
"""
import os
import sys
from decimal import Decimal
from dotenv import load_dotenv

load_dotenv()

import bcrypt
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    print("ERROR: DATABASE_URL not set in .env")
    sys.exit(1)

engine = create_engine(DATABASE_URL)
Session = sessionmaker(bind=engine)
db = Session()

DUMMY_USERS = [
    {"email": "alice@transactiq.com",   "password": "alice123"},
    {"email": "bob@transactiq.com",     "password": "bob123"},
    {"email": "charlie@transactiq.com", "password": "charlie123"},
    {"email": "diana@transactiq.com",   "password": "diana123"},
]

def hash_pw(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

try:
    created_users = []

    for u in DUMMY_USERS:
        # Check if user already exists
        result = db.execute(text("SELECT id FROM users WHERE email = :email"), {"email": u["email"]}).fetchone()
        if result:
            user_id = result[0]
            print(f"  [skip] User already exists: {u['email']} (id={user_id})")
        else:
            result = db.execute(
                text("INSERT INTO users (email, password_hash, created_at) VALUES (:email, :pw, NOW()) RETURNING id"),
                {"email": u["email"], "pw": hash_pw(u["password"])}
            )
            user_id = result.fetchone()[0]
            print(f"  [+] Created user: {u['email']} (id={user_id})")

        created_users.append({"email": u["email"], "password": u["password"], "user_id": user_id})

    db.commit()

    print("\nCreating accounts with Rs.2000 balance...\n")

    for u in created_users:
        # Check if account already exists for this user
        result = db.execute(text("SELECT id FROM accounts WHERE user_id = :uid"), {"uid": u["user_id"]}).fetchone()
        if result:
            acct_id = result[0]
            print(f"  [skip] Account already exists for {u['email']}: account #{acct_id}")
        else:
            result = db.execute(
                text("INSERT INTO accounts (user_id, balance, currency, created_at, updated_at) VALUES (:uid, :bal, 'INR', NOW(), NOW()) RETURNING id"),
                {"uid": u["user_id"], "bal": Decimal("2000.00")}
            )
            acct_id = result.fetchone()[0]
            print(f"  [+] Created account #{acct_id} for {u['email']} - Rs.2000.00")

        u["account_id"] = acct_id

    db.commit()

    print("\n" + "="*55)
    print("  DUMMY ACCOUNTS READY")
    print("="*55)
    print(f"  {'Email':<28} {'Password':<12} {'Account'}")
    print("-"*55)
    for u in created_users:
        print(f"  {u['email']:<28} {u['password']:<12} #{u.get('account_id','?')}")
    print("="*55)
    print("\nAll accounts have Rs.2000.00 balance.\n")

except Exception as e:
    db.rollback()
    print(f"\nERROR: {e}")
    import traceback; traceback.print_exc()
finally:
    db.close()
