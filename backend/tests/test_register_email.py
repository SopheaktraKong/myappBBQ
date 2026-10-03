"""Regression tests for SignupIn.email Optional[str] fix (empty email must NOT 422)."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
API = f"{BASE_URL}/api"
OWNER_PASSWORD = os.environ.get("TEST_OWNER_PASSWORD", "")
assert OWNER_PASSWORD


@pytest.fixture(scope="module")
def owner_headers():
    r = requests.post(f"{API}/auth/login", json={"username": "admin", "password": OWNER_PASSWORD}, timeout=10)
    assert r.status_code == 200
    return {"Authorization": f"Bearer {r.json()['token']}"}


@pytest.fixture(scope="module")
def created_ids():
    ids = []
    yield ids


def _cleanup(ids, headers):
    for uid in ids:
        requests.delete(f"{API}/auth/staff/{uid}", headers=headers, timeout=10)


def test_register_with_empty_email(owner_headers, created_ids):
    username = f"TEST_empty_{uuid.uuid4().hex[:6]}"
    r = requests.post(f"{API}/auth/register", json={
        "username": username, "email": "", "password": "pass1234",
        "name": "TEST Empty Email", "role": "waiter",
    }, headers=owner_headers, timeout=10)
    assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
    data = r.json()
    assert data["username"].lower() == username.lower()
    created_ids.append(data["id"])
    _cleanup([data["id"]], owner_headers)


def test_register_with_omitted_email(owner_headers):
    username = f"TEST_omit_{uuid.uuid4().hex[:6]}"
    r = requests.post(f"{API}/auth/register", json={
        "username": username, "password": "pass1234",
        "name": "TEST Omit Email", "role": "waiter",
    }, headers=owner_headers, timeout=10)
    assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
    data = r.json()
    assert data["username"].lower() == username.lower()
    _cleanup([data["id"]], owner_headers)


def test_register_with_real_email(owner_headers):
    username = f"TEST_email_{uuid.uuid4().hex[:6]}"
    r = requests.post(f"{API}/auth/register", json={
        "username": username, "email": "sopha@bbq.example",
        "password": "pass1234", "name": "TEST Real Email", "role": "waiter",
    }, headers=owner_headers, timeout=10)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["email"] == "sopha@bbq.example"
    _cleanup([data["id"]], owner_headers)


def test_register_duplicate_username_returns_400(owner_headers):
    username = f"TEST_dup_{uuid.uuid4().hex[:6]}"
    payload = {"username": username, "password": "pass1234", "name": "Dup", "role": "waiter"}
    r1 = requests.post(f"{API}/auth/register", json=payload, headers=owner_headers, timeout=10)
    assert r1.status_code == 200
    uid = r1.json()["id"]
    r2 = requests.post(f"{API}/auth/register", json=payload, headers=owner_headers, timeout=10)
    assert r2.status_code == 400, f"Expected 400 duplicate, got {r2.status_code}: {r2.text}"
    # detail should be a plain string, not an array
    detail = r2.json().get("detail")
    assert isinstance(detail, str), f"Expected string detail, got {type(detail).__name__}: {detail}"
    _cleanup([uid], owner_headers)
