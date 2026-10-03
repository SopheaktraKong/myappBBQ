"""Backend tests for KHQR static image payment flow (iteration 7)."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://bbq-qr-order.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"
OWNER_USER = "admin"
OWNER_PW = os.environ.get("TEST_OWNER_PASSWORD", "90919091")


@pytest.fixture(scope="module")
def owner_token():
    r = requests.post(f"{API}/auth/login", json={"username": OWNER_USER, "password": OWNER_PW}, timeout=20)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def owner_headers(owner_token):
    return {"Authorization": f"Bearer {owner_token}"}


@pytest.fixture(scope="module")
def t01_table(owner_headers):
    # Find or create T-01
    r = requests.get(f"{API}/tables", timeout=20)
    assert r.status_code == 200
    for t in r.json():
        if t["label"] == "T-01":
            return t
    r = requests.post(f"{API}/tables", headers=owner_headers, json={"label": "T-01", "seats": 4}, timeout=20)
    assert r.status_code == 200
    return r.json()


@pytest.fixture
def fresh_session_with_order(t01_table, owner_headers):
    # Close any existing session on this table to start fresh
    requests.post(f"{API}/tables/{t01_table['id']}/clear", headers=owner_headers, timeout=20)
    # Open fresh session
    r = requests.post(f"{API}/sessions/open", params={"table_id": t01_table["id"]}, timeout=20)
    assert r.status_code == 200
    session = r.json()
    # Need a menu item
    m = requests.get(f"{API}/menu", timeout=20).json()
    items = [i for i in m["items"] if i.get("available", True)]
    if not items:
        # seed category + item
        c = requests.post(f"{API}/categories", headers=owner_headers,
                          json={"name_en": "TEST_Cat", "name_km": "", "sort_order": 1}, timeout=20).json()
        it = requests.post(f"{API}/menu/items", headers=owner_headers, json={
            "category_id": c["id"], "name_en": "TEST_Item", "price": 5.0, "available": True
        }, timeout=20).json()
        items = [it]
    item = items[0]
    r = requests.post(f"{API}/orders", json={
        "table_id": t01_table["id"],
        "session_id": session["id"],
        "items": [{"item_id": item["id"], "quantity": 1, "note": ""}],
        "phone": "", "guest_name": "TEST_Guest",
    }, timeout=20)
    assert r.status_code == 200, r.text
    return session


# ---- static image ----
def test_static_khqr_image():
    r = requests.get(f"{API}/static/aba_khqr.jpg", timeout=20)
    assert r.status_code == 200
    assert r.headers.get("content-type", "").startswith("image/")
    assert len(r.content) > 10000


# ---- pay khqr ----
def test_pay_khqr_returns_static_url(fresh_session_with_order):
    sid = fresh_session_with_order["id"]
    r = requests.post(f"{API}/sessions/{sid}/pay", params={"method": "khqr"}, timeout=20)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["qr_url"] == "/api/static/aba_khqr.jpg"
    assert d["owner_name"] == "SOPHEAKTRA KONG"
    assert d["usd_account"] == "012 438 625"
    assert d["khr_account"] == "500 930 413"
    assert d["bill_number"].startswith("BBQ")
    assert d["amount"] > 0
    assert "qr_image" not in d  # no base64


def test_pay_payway_rejected(fresh_session_with_order):
    sid = fresh_session_with_order["id"]
    r = requests.post(f"{API}/sessions/{sid}/pay", params={"method": "payway"}, timeout=20)
    assert r.status_code == 400
    assert "Unsupported" in r.text or "unsupported" in r.text.lower()


def test_pay_cash_ok(fresh_session_with_order):
    sid = fresh_session_with_order["id"]
    r = requests.post(f"{API}/sessions/{sid}/pay", params={"method": "cash"}, timeout=20)
    assert r.status_code == 200
    assert r.json()["method"] == "cash"


# ---- menu publicly accessible (no 401) ----
def test_menu_public():
    r = requests.get(f"{API}/menu", timeout=20)
    assert r.status_code == 200


# ---- settings PUT accepts the current payload shape ----
def test_settings_save(owner_headers):
    r = requests.put(f"{API}/settings", headers=owner_headers, json={
        "accept_cash": True, "accept_khqr": True, "accept_payway": False,
        "tax_inclusive": True, "restaurant_name": "BBQ Nights",
    }, timeout=20)
    assert r.status_code == 200
