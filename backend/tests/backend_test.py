"""BBQ QR Menu backend integration tests."""
import json
import os
import threading
import time
import uuid

import pytest
import requests
import websocket

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # fallback from frontend/.env
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")

API = f"{BASE_URL}/api"
OWNER_USERNAME = os.environ.get("TEST_OWNER_USERNAME", "admin")
OWNER_PASSWORD = os.environ.get("TEST_OWNER_PASSWORD", "")
assert OWNER_PASSWORD, "TEST_OWNER_PASSWORD env var required to run backend tests"


@pytest.fixture(scope="session")
def owner_token():
    r = requests.post(f"{API}/auth/login", json={"username": OWNER_USERNAME, "password": OWNER_PASSWORD}, timeout=20)
    assert r.status_code == 200, f"Owner login failed: {r.status_code} {r.text}"
    data = r.json()
    assert "token" in data and data["user"]["role"] == "owner"
    return data["token"]


@pytest.fixture(scope="session")
def owner_headers(owner_token):
    return {"Authorization": f"Bearer {owner_token}"}


# ---------- Health & Auth ----------
def test_health():
    r = requests.get(f"{API}/health", timeout=10)
    assert r.status_code == 200
    assert r.json()["ok"] is True


def test_login_invalid():
    r = requests.post(f"{API}/auth/login", json={"username": OWNER_USERNAME, "password": "wrong"}, timeout=10)
    assert r.status_code == 401


def test_me(owner_headers):
    r = requests.get(f"{API}/auth/me", headers=owner_headers, timeout=10)
    assert r.status_code == 200
    assert r.json()["username"] == OWNER_USERNAME


def test_me_no_token():
    r = requests.get(f"{API}/auth/me", timeout=10)
    assert r.status_code == 401


# ---------- Categories & Menu ----------
@pytest.fixture(scope="session")
def test_category(owner_headers):
    payload = {"name_en": f"TEST_Cat_{uuid.uuid4().hex[:6]}", "name_km": "សាកល្បង", "sort_order": 99}
    r = requests.post(f"{API}/categories", json=payload, headers=owner_headers, timeout=10)
    assert r.status_code == 200, r.text
    cat = r.json()
    assert cat["name_en"] == payload["name_en"]
    assert "id" in cat
    yield cat
    requests.delete(f"{API}/categories/{cat['id']}", headers=owner_headers, timeout=10)


def test_list_categories_public():
    r = requests.get(f"{API}/categories", timeout=10)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_create_category_unauthorized():
    r = requests.post(f"{API}/categories", json={"name_en": "x", "name_km": "y"}, timeout=10)
    assert r.status_code == 401


@pytest.fixture(scope="session")
def test_menu_item(owner_headers, test_category):
    payload = {
        "category_id": test_category["id"],
        "name_en": f"TEST_Item_{uuid.uuid4().hex[:6]}",
        "name_km": "សាច់",
        "price": 9.99,
        "available": True,
    }
    r = requests.post(f"{API}/menu/items", json=payload, headers=owner_headers, timeout=10)
    assert r.status_code == 200, r.text
    item = r.json()
    assert item["price"] == 9.99
    assert "id" in item
    yield item
    requests.delete(f"{API}/menu/items/{item['id']}", headers=owner_headers, timeout=10)


def test_menu_get_public(test_menu_item):
    r = requests.get(f"{API}/menu", timeout=10)
    assert r.status_code == 200
    data = r.json()
    ids = [i["id"] for i in data["items"]]
    assert test_menu_item["id"] in ids


def test_toggle_availability(owner_headers, test_menu_item):
    r = requests.patch(f"{API}/menu/items/{test_menu_item['id']}/availability",
                       params={"available": False}, headers=owner_headers, timeout=10)
    assert r.status_code == 200
    menu = requests.get(f"{API}/menu", timeout=10).json()
    item = next(i for i in menu["items"] if i["id"] == test_menu_item["id"])
    assert item["available"] is False
    # restore
    requests.patch(f"{API}/menu/items/{test_menu_item['id']}/availability",
                   params={"available": True}, headers=owner_headers, timeout=10)


# ---------- Tables ----------
@pytest.fixture(scope="session")
def test_table(owner_headers):
    label = f"T-TST{uuid.uuid4().hex[:3].upper()}"
    r = requests.post(f"{API}/tables", json={"label": label, "seats": 4}, headers=owner_headers, timeout=10)
    assert r.status_code == 200, r.text
    tbl = r.json()
    assert tbl["label"] == label
    yield tbl
    requests.delete(f"{API}/tables/{tbl['id']}", headers=owner_headers, timeout=10)


def test_list_tables_public(test_table):
    r = requests.get(f"{API}/tables", timeout=10)
    assert r.status_code == 200
    labels = [t["label"] for t in r.json()]
    assert test_table["label"] in labels


def test_duplicate_table_rejected(owner_headers, test_table):
    r = requests.post(f"{API}/tables", json={"label": test_table["label"], "seats": 2},
                      headers=owner_headers, timeout=10)
    assert r.status_code == 400


# ---------- Session + Order + Payment full flow ----------
@pytest.fixture(scope="session")
def open_session(test_table):
    r = requests.post(f"{API}/sessions/open", params={"table_id": test_table["id"]}, timeout=10)
    assert r.status_code == 200, r.text
    s = r.json()
    assert s["status"] == "open"
    return s


def test_order_flow_and_ws(test_table, test_menu_item, open_session, owner_headers):
    # Subscribe WS
    ws_url = BASE_URL.replace("http", "ws") + "/api/ws"
    events = []
    stop = threading.Event()

    def run_ws():
        try:
            ws = websocket.create_connection(ws_url, timeout=15)
            ws.settimeout(15)
            while not stop.is_set():
                try:
                    msg = ws.recv()
                    if msg:
                        events.append(json.loads(msg))
                except (websocket.WebSocketException, OSError, json.JSONDecodeError):
                    break
            ws.close()
        except (websocket.WebSocketException, OSError) as e:
            events.append({"error": str(e)})

    t = threading.Thread(target=run_ws, daemon=True)
    t.start()
    time.sleep(2)

    # Ensure item available
    requests.patch(f"{API}/menu/items/{test_menu_item['id']}/availability",
                   params={"available": True}, headers=owner_headers, timeout=10)

    order_payload = {
        "table_id": test_table["id"],
        "session_id": open_session["id"],
        "items": [{"item_id": test_menu_item["id"], "quantity": 2, "note": "extra spicy"}],
        "guest_name": "TESTGuest",
    }
    r = requests.post(f"{API}/orders", json=order_payload, timeout=15)
    assert r.status_code == 200, r.text
    order = r.json()
    assert order["subtotal"] == pytest.approx(9.99 * 2)
    assert len(order["items"]) == 1
    oid = order["id"]

    time.sleep(2)
    stop.set()
    t.join(timeout=5)
    types = [e.get("type") for e in events]
    assert "new_order" in types, f"WS events: {events}"

    # Update item status
    r = requests.patch(f"{API}/orders/{oid}/item/0", params={"status": "preparing"},
                       headers=owner_headers, timeout=10)
    assert r.status_code == 200
    assert r.json()["status"] == "preparing"

    r = requests.patch(f"{API}/orders/{oid}/item/0", params={"status": "ready"},
                       headers=owner_headers, timeout=10)
    assert r.status_code == 200
    assert r.json()["status"] == "ready"

    # Verify tables endpoint shows total
    tables = requests.get(f"{API}/tables", timeout=10).json()
    tt = next(t for t in tables if t["id"] == test_table["id"])
    assert tt["total"] == pytest.approx(9.99 * 2)
    assert tt["order_count"] == 1

    # Call staff
    r = requests.post(f"{API}/sessions/{open_session['id']}/call-staff", timeout=10)
    assert r.status_code == 200
    tables = requests.get(f"{API}/tables", timeout=10).json()
    tt = next(t for t in tables if t["id"] == test_table["id"])
    assert tt["needs_staff"] is True

    # Ask for bill
    r = requests.post(f"{API}/sessions/{open_session['id']}/ask-bill", timeout=10)
    assert r.status_code == 200

    # KHQR payment
    r = requests.post(f"{API}/sessions/{open_session['id']}/pay", params={"method": "khqr"}, timeout=15)
    assert r.status_code == 200, r.text
    pay = r.json()
    assert pay["method"] == "khqr"
    assert pay["amount"] == pytest.approx(9.99 * 2)
    assert pay.get("qr_image", "").startswith("data:image/png;base64,")

    # mock-confirm
    r = requests.post(f"{API}/payments/{pay['id']}/mock-confirm", timeout=10)
    assert r.status_code == 200

    # Verify session closed → total 0
    tables = requests.get(f"{API}/tables", timeout=10).json()
    tt = next(t for t in tables if t["id"] == test_table["id"])
    assert tt["total"] == 0
    assert tt.get("session") is None


def test_order_invalid_session(test_table, test_menu_item):
    r = requests.post(f"{API}/orders", json={
        "table_id": test_table["id"],
        "session_id": "nonexistent",
        "items": [{"item_id": test_menu_item["id"], "quantity": 1}],
    }, timeout=10)
    assert r.status_code == 400


# ---------- Payment method toggles ----------
def test_payment_cash_when_disabled(owner_headers, test_table, test_menu_item):
    # Open new session
    s = requests.post(f"{API}/sessions/open", params={"table_id": test_table["id"]}, timeout=10).json()
    requests.post(f"{API}/orders", json={
        "table_id": test_table["id"],
        "session_id": s["id"],
        "items": [{"item_id": test_menu_item["id"], "quantity": 1}],
    }, timeout=10)
    # Disable cash
    settings = requests.get(f"{API}/settings", timeout=10).json()
    body = {k: settings.get(k, True) for k in ["accept_cash", "accept_khqr", "accept_payway", "tax_inclusive"]}
    body["restaurant_name"] = settings.get("restaurant_name", "BBQ Nights")
    body["accept_cash"] = False
    r = requests.put(f"{API}/settings", json=body, headers=owner_headers, timeout=10)
    assert r.status_code == 200
    r = requests.post(f"{API}/sessions/{s['id']}/pay", params={"method": "cash"}, timeout=10)
    assert r.status_code == 400
    # restore + cleanup
    body["accept_cash"] = True
    requests.put(f"{API}/settings", json=body, headers=owner_headers, timeout=10)
    # close session via cash pay
    r = requests.post(f"{API}/sessions/{s['id']}/pay", params={"method": "cash"}, timeout=10)
    pid = r.json()["id"]
    requests.post(f"{API}/payments/{pid}/mock-confirm", timeout=10)


# ---------- Staff & Roles ----------
@pytest.fixture(scope="session")
def waiter_account(owner_headers):
    suffix = uuid.uuid4().hex[:6]
    username = f"test_waiter_{suffix}"
    email = f"{username}@test.com"
    r = requests.post(f"{API}/auth/register", json={
        "username": username, "email": email, "password": "Waiter@2026",
        "name": "TEST Waiter", "role": "waiter",
    }, headers=owner_headers, timeout=10)
    assert r.status_code == 200, r.text
    user = r.json()
    yield {"username": username, "email": email, "password": "Waiter@2026", "id": user["id"]}
    requests.delete(f"{API}/auth/staff/{user['id']}", headers=owner_headers, timeout=10)


def test_waiter_role_permissions(waiter_account):
    r = requests.post(f"{API}/auth/login", json={"username": waiter_account["username"], "password": waiter_account["password"]}, timeout=10)
    assert r.status_code == 200
    tok = r.json()["token"]
    h = {"Authorization": f"Bearer {tok}"}

    # Waiter cannot list staff
    r = requests.get(f"{API}/auth/staff", headers=h, timeout=10)
    assert r.status_code == 403

    # Waiter cannot access dashboard
    r = requests.get(f"{API}/dashboard/summary", headers=h, timeout=10)
    assert r.status_code == 403

    # Waiter cannot create category
    r = requests.post(f"{API}/categories", json={"name_en": "x"}, headers=h, timeout=10)
    assert r.status_code == 403

    # Waiter CAN access kitchen orders
    r = requests.get(f"{API}/orders/kitchen", headers=h, timeout=10)
    assert r.status_code == 200


def test_dashboard_summary(owner_headers):
    r = requests.get(f"{API}/dashboard/summary", headers=owner_headers, timeout=10)
    assert r.status_code == 200
    d = r.json()
    for k in ["revenue", "order_count", "payment_count", "top_items", "daily"]:
        assert k in d


# ---------- Settings ----------
def test_settings_public_get():
    r = requests.get(f"{API}/settings", timeout=10)
    assert r.status_code == 200


def test_settings_update_unauth():
    r = requests.put(f"{API}/settings", json={"accept_cash": True}, timeout=10)
    assert r.status_code == 401
