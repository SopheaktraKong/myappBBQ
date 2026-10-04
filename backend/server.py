from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, WebSocket, WebSocketDisconnect, Header, Query
from fastapi.responses import Response
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Literal, Set
from pathlib import Path
from datetime import datetime, timezone, timedelta
from decimal import Decimal
from passlib.context import CryptContext
from jose import jwt, JWTError
from bakong_khqr import KHQR
import qrcode
import io
import base64
import os
import uuid
import json
import asyncio
import logging
import requests
import os
import cloudinary
import cloudinary.uploader

cloudinary.config(
    cloud_name=os.environ.get('oizbysro'),
    api_key=os.environ.get('699364372979658'),
    api_secret=os.environ.get('QPxCR6Uiw66R1vNqJv7nod8WEGA')
)

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Env
MONGO_URL = os.environ['MONGO_URL']
DB_NAME = os.environ['DB_NAME']
JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALG = os.environ.get('JWT_ALG', 'HS256')
JWT_EXPIRE_HOURS = int(os.environ.get('JWT_EXPIRE_HOURS', '72'))
OWNER_EMAIL = os.environ['OWNER_EMAIL']
OWNER_PASSWORD = os.environ['OWNER_PASSWORD']
OWNER_NAME = os.environ.get('OWNER_NAME', 'Owner')
PAYMENT_MODE = os.environ.get('PAYMENT_MODE', 'mock')
BAKONG_ACCOUNT_ID = os.environ.get('BAKONG_ACCOUNT_ID', 'bbq@aclb')
BAKONG_TOKEN = os.environ.get('BAKONG_TOKEN', '')
BAKONG_MERCHANT_NAME = os.environ.get('BAKONG_MERCHANT_NAME', 'BBQ Nights')
BAKONG_MERCHANT_CITY = os.environ.get('BAKONG_MERCHANT_CITY', 'Phnom Penh')
APP_NAME = os.environ.get('APP_NAME', 'bbqqr')

# Storage
STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY", "")
_storage_key: Optional[str] = None

def init_storage(force: bool = False):
    global _storage_key
    if _storage_key and not force:
        return _storage_key
    try:
        resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_KEY}, timeout=30)
        resp.raise_for_status()
        _storage_key = resp.json()["storage_key"]
        return _storage_key
    except Exception as e:
        logger.warning(f"Storage init failed: {e}")
        return None

def put_object(path: str, data: bytes, content_type: str):
    key = init_storage()
    if not key:
        raise HTTPException(503, "Storage not available")
    resp = requests.put(f"{STORAGE_URL}/objects/{path}",
                        headers={"X-Storage-Key": key, "Content-Type": content_type},
                        data=data, timeout=120)
    if resp.status_code == 404:
        key = init_storage(force=True)
        resp = requests.put(f"{STORAGE_URL}/objects/{path}",
                            headers={"X-Storage-Key": key, "Content-Type": content_type},
                            data=data, timeout=120)
    resp.raise_for_status()
    return resp.json()

def get_object(path: str):
    key = init_storage()
    if not key:
        raise HTTPException(503, "Storage not available")
    resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")

# DB
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

# Auth
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_pw(p: str) -> str:
    return pwd_context.hash(p)

def verify_pw(p: str, h: str) -> bool:
    try:
        return pwd_context.verify(p, h)
    except Exception:
        return False

def create_token(user_id: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRE_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)

async def get_current_user(authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Missing token")
    token = authorization.split(" ", 1)[1]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
    except JWTError:
        raise HTTPException(401, "Invalid token")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(401, "User not found")
    return user

def require_roles(*roles: str):
    async def _dep(user=Depends(get_current_user)):
        if user["role"] not in roles:
            raise HTTPException(403, "Forbidden")
        return user
    return _dep

# ----------------------------- Models -----------------------------
class SignupIn(BaseModel):
    username: str
    email: Optional[str] = None
    password: str
    name: str
    role: Literal["owner", "waiter", "kitchen"] = "waiter"

class UpdateStaffIn(BaseModel):
    username: Optional[str] = None
    email: Optional[str] = None
    name: Optional[str] = None
    password: Optional[str] = None
    role: Optional[Literal["owner", "waiter", "kitchen"]] = None

class LoginIn(BaseModel):
    username: str
    password: str

class CategoryIn(BaseModel):
    name_en: str
    name_km: str = ""
    sort_order: int = 0

class MenuItemIn(BaseModel):
    category_id: str
    name_en: str
    name_km: str = ""
    description_en: str = ""
    description_km: str = ""
    price: float
    image_url: str = ""
    available: bool = True
    popular: bool = False

class TableIn(BaseModel):
    label: str
    seats: int = 4

class OrderItemIn(BaseModel):
    item_id: str
    quantity: int
    note: str = ""

class OrderIn(BaseModel):
    table_id: str
    session_id: str
    items: List[OrderItemIn]
    phone: str = ""
    guest_name: str = ""

class SettingsIn(BaseModel):
    accept_cash: bool = True
    accept_khqr: bool = True
    accept_payway: bool = True
    tax_inclusive: bool = True
    restaurant_name: str = "BBQ Nights"

# ----------------------------- App -----------------------------
app = FastAPI(title="BBQ QR Menu")
api = APIRouter(prefix="/api")

# WebSocket manager
class WSManager:
    def __init__(self):
        self.conns: Set[WebSocket] = set()

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.conns.add(ws)

    def disconnect(self, ws: WebSocket):
        self.conns.discard(ws)

    async def broadcast(self, event: dict):
        dead = []
        for ws in list(self.conns):
            try:
                await ws.send_json(event)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.conns.discard(ws)

ws_manager = WSManager()

def now_iso():
    return datetime.now(timezone.utc).isoformat()

# ----------------------------- Startup -----------------------------
@app.on_event("startup")
async def startup():
    init_storage()
    # Drop legacy unique index on email (older schema)
    try:
        await db.users.drop_index("email_1")
        logger.info("Dropped legacy users.email_1 index")
    except Exception:
        pass
    # Seed default admin (username=admin, password from OWNER_PASSWORD env). Idempotent.
    if not await db.users.find_one({"username": "admin"}):
        # Also remove any prior owner doc with the same email to avoid duplicates
        await db.users.delete_many({"email": OWNER_EMAIL.lower(), "username": {"$exists": False}})
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "username": "admin",
            "email": OWNER_EMAIL.lower(),
            "name": OWNER_NAME,
            "role": "owner",
            "password_hash": hash_pw(OWNER_PASSWORD),
            "active": True,
            "created_at": now_iso(),
        })
        logger.info("Seeded admin user (username=admin) with OWNER_PASSWORD from env")
    # Default settings
    if not await db.settings.find_one({"id": "app"}):
        await db.settings.insert_one({
            "id": "app",
            "accept_cash": True, "accept_khqr": True, "accept_payway": False,
            "tax_inclusive": True, "restaurant_name": "BBQ Nights",
        })
    # Indexes
    await db.orders.create_index("session_id")
    await db.orders.create_index("table_id")
    await db.orders.create_index("status")
    await db.users.create_index("username", unique=True, sparse=True)
    await db.tables.create_index("label", unique=True)

# ----------------------------- Auth -----------------------------
@api.post("/auth/register")
async def register(body: SignupIn, user=Depends(require_roles("owner"))):
    username = body.username.strip().lower()
    if not username:
        raise HTTPException(400, "Username required")
    if await db.users.find_one({"username": username}):
        raise HTTPException(400, "Username already exists")
    doc = {
        "id": str(uuid.uuid4()),
        "username": username,
        "email": (body.email or "").lower(),
        "name": body.name,
        "role": body.role,
        "password_hash": hash_pw(body.password),
        "active": True,
        "created_at": now_iso(),
    }
    await db.users.insert_one(doc)
    return {"id": doc["id"], "username": username, "email": doc["email"], "role": body.role, "name": body.name}

@api.post("/auth/login")
async def login(body: LoginIn):
    username = body.username.strip().lower()
    user = await db.users.find_one({"$or": [{"username": username}, {"email": username}]})
    if not user or not verify_pw(body.password, user.get("password_hash", "")):
        raise HTTPException(401, "Invalid credentials")
    if not user.get("active", True):
        raise HTTPException(403, "Account disabled")
    if user["role"] not in ("owner", "waiter", "kitchen"):
        raise HTTPException(403, "Only staff/admin can log in")
    token = create_token(user["id"], user["role"])
    return {"token": token, "user": {"id": user["id"], "username": user.get("username", ""), "email": user.get("email", ""), "role": user["role"], "name": user["name"]}}

@api.get("/auth/me")
async def me(user=Depends(get_current_user)):
    return user

@api.get("/auth/staff")
async def list_staff(user=Depends(require_roles("owner"))):
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(500)
    return users

@api.delete("/auth/staff/{staff_id}")
async def delete_staff(staff_id: str, user=Depends(require_roles("owner"))):
    if staff_id == user["id"]:
        raise HTTPException(400, "Cannot remove yourself")
    await db.users.delete_one({"id": staff_id})
    return {"ok": True}

@api.patch("/auth/staff/{staff_id}")
async def update_staff(staff_id: str, body: UpdateStaffIn, user=Depends(require_roles("owner"))):
    target = await db.users.find_one({"id": staff_id})
    if not target:
        raise HTTPException(404, "Staff not found")
    update = {}
    if body.name is not None:
        update["name"] = body.name.strip()
    if body.email is not None:
        update["email"] = body.email.strip().lower()
    if body.username is not None:
        new_username = body.username.strip().lower()
        if not new_username:
            raise HTTPException(400, "Username cannot be empty")
        if new_username != target.get("username"):
            existing = await db.users.find_one({"username": new_username})
            if existing:
                raise HTTPException(400, "Username already taken")
            update["username"] = new_username
    if body.password:
        if len(body.password) < 4:
            raise HTTPException(400, "Password too short")
        update["password_hash"] = hash_pw(body.password)
    if body.role is not None:
        # Prevent demoting yourself out of owner role
        if staff_id == user["id"] and body.role != "owner":
            raise HTTPException(400, "You cannot change your own role")
        update["role"] = body.role
    if not update:
        return {"ok": True, "unchanged": True}
    await db.users.update_one({"id": staff_id}, {"$set": update})
    updated = await db.users.find_one({"id": staff_id}, {"_id": 0, "password_hash": 0})
    return updated

# ----------------------------- Categories -----------------------------
@api.get("/categories")
async def list_categories():
    cats = await db.categories.find({}, {"_id": 0}).sort("sort_order", 1).to_list(500)
    return cats

@api.post("/categories")
async def create_category(body: CategoryIn, user=Depends(require_roles("owner"))):
    doc = {"id": str(uuid.uuid4()), **body.model_dump(), "created_at": now_iso()}
    await db.categories.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api.put("/categories/{cid}")
async def update_category(cid: str, body: CategoryIn, user=Depends(require_roles("owner"))):
    await db.categories.update_one({"id": cid}, {"$set": body.model_dump()})
    return {"ok": True}

@api.delete("/categories/{cid}")
async def delete_category(cid: str, user=Depends(require_roles("owner"))):
    await db.categories.delete_one({"id": cid})
    await db.menu_items.delete_many({"category_id": cid})
    return {"ok": True}

# ----------------------------- Menu Items -----------------------------
@api.get("/menu")
async def get_menu():
    cats = await db.categories.find({}, {"_id": 0}).sort("sort_order", 1).to_list(500)
    items = await db.menu_items.find({}, {"_id": 0}).to_list(1000)
    return {"categories": cats, "items": items}

@api.post("/menu/items")
async def create_item(body: MenuItemIn, user=Depends(require_roles("owner"))):
    doc = {"id": str(uuid.uuid4()), **body.model_dump(), "created_at": now_iso()}
    await db.menu_items.insert_one(doc)
    doc.pop("_id", None)
    await ws_manager.broadcast({"type": "menu_updated"})
    return doc

@api.put("/menu/items/{item_id}")
async def update_item(item_id: str, body: MenuItemIn, user=Depends(require_roles("owner"))):
    await db.menu_items.update_one({"id": item_id}, {"$set": body.model_dump()})
    await ws_manager.broadcast({"type": "menu_updated"})
    return {"ok": True}

@api.patch("/menu/items/{item_id}/availability")
async def toggle_availability(item_id: str, available: bool = Query(...), user=Depends(require_roles("owner", "waiter"))):
    await db.menu_items.update_one({"id": item_id}, {"$set": {"available": available}})
    await ws_manager.broadcast({"type": "menu_updated"})
    return {"ok": True}

@api.delete("/menu/items/{item_id}")
async def delete_item(item_id: str, user=Depends(require_roles("owner"))):
    await db.menu_items.delete_one({"id": item_id})
    await ws_manager.broadcast({"type": "menu_updated"})
    return {"ok": True}

UPLOAD_DIR = ROOT_DIR / "static" / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

@api.post("/upload/image")
async def upload_image(file: UploadFile = File(...), user=Depends(require_roles("owner"))):
    data = await file.read()
    upload_result = cloudinary.uploader.upload(data)
    image_url = upload_result.get("secure_url")
    return {"url": image_url}

@api.get("/files/{path:path}")
async def get_file(path: str):
    filename = path.rsplit("/", 1)[-1]
    file_path = UPLOAD_DIR / filename
    if not file_path.exists():
        raise HTTPException(404, "File not found")
    
    ext = filename.rsplit(".", 1)[-1].lower()
    media_types = {
        "png": "image/png",
        "jpg": "image/jpeg",
        "jpeg": "image/jpeg",
        "webp": "image/webp",
        "gif": "image/gif"
    }
    content_type = media_types.get(ext, "image/png")
    
    with open(file_path, "rb") as f:
        content = f.read()
    return Response(content=content, media_type=content_type)

# ----------------------------- Tables -----------------------------
@api.get("/tables")
async def list_tables():
    tables = await db.tables.find({}, {"_id": 0}).sort("label", 1).to_list(200)
    # Attach open session info
    for t in tables:
        session = await db.sessions.find_one({"table_id": t["id"], "status": "open"}, {"_id": 0})
        t["session"] = session
        if session:
            orders = await db.orders.find({"session_id": session["id"]}, {"_id": 0}).to_list(200)
            t["total"] = sum(sum(i["price"] * i["quantity"] for i in o["items"]) for o in orders)
            t["order_count"] = len(orders)
            t["needs_staff"] = session.get("needs_staff", False) or session.get("ask_for_bill", False)
        else:
            t["total"] = 0
            t["order_count"] = 0
            t["needs_staff"] = False
    return tables

@api.post("/tables")
async def create_table(body: TableIn, user=Depends(require_roles("owner"))):
    doc = {"id": str(uuid.uuid4()), "label": body.label, "seats": body.seats, "created_at": now_iso()}
    try:
        await db.tables.insert_one(doc)
    except Exception:
        raise HTTPException(400, "Table label already exists")
    doc.pop("_id", None)
    return doc

@api.delete("/tables/{tid}")
async def delete_table(tid: str, user=Depends(require_roles("owner"))):
    await db.tables.delete_one({"id": tid})
    return {"ok": True}

# ----------------------------- Sessions (per-table shared bill) -----------------------------
@api.post("/sessions/open")
async def open_session(table_id: str = Query(...)):
    """Called by customer scanning QR. Returns/creates the open session for that table."""
    table = await db.tables.find_one({"id": table_id}, {"_id": 0})
    if not table:
        raise HTTPException(404, "Table not found")
    session = await db.sessions.find_one({"table_id": table_id, "status": "open"}, {"_id": 0})
    if not session:
        session = {
            "id": str(uuid.uuid4()),
            "table_id": table_id,
            "table_label": table["label"],
            "status": "open",
            "opened_at": now_iso(),
            "needs_staff": False,
            "ask_for_bill": False,
            "guests": [],
        }
        await db.sessions.insert_one(session)
        session.pop("_id", None)
        await ws_manager.broadcast({"type": "session_opened", "session": session})
    return session

@api.get("/sessions/{sid}")
async def get_session(sid: str):
    session = await db.sessions.find_one({"id": sid}, {"_id": 0})
    if not session:
        raise HTTPException(404, "Session not found")
    orders = await db.orders.find({"session_id": sid}, {"_id": 0}).to_list(500)
    total = sum(sum(i["price"] * i["quantity"] for i in o["items"]) for o in orders)
    # per-guest breakdown
    by_guest = {}
    for o in orders:
        g = o.get("guest_name") or "Guest"
        by_guest.setdefault(g, 0)
        by_guest[g] += sum(i["price"] * i["quantity"] for i in o["items"])
    return {"session": session, "orders": orders, "total": total, "by_guest": by_guest}

@api.post("/sessions/{sid}/call-staff")
async def call_staff(sid: str):
    await db.sessions.update_one({"id": sid}, {"$set": {"needs_staff": True}})
    session = await db.sessions.find_one({"id": sid}, {"_id": 0})
    await ws_manager.broadcast({"type": "call_staff", "session": session})
    return {"ok": True}

@api.post("/sessions/{sid}/ask-bill")
async def ask_bill(sid: str):
    await db.sessions.update_one({"id": sid}, {"$set": {"ask_for_bill": True, "needs_staff": True}})
    session = await db.sessions.find_one({"id": sid}, {"_id": 0})
    await ws_manager.broadcast({"type": "ask_bill", "session": session})
    return {"ok": True}

@api.post("/sessions/{sid}/clear-attention")
async def clear_attention(sid: str, user=Depends(require_roles("owner", "waiter"))):
    await db.sessions.update_one({"id": sid}, {"$set": {"needs_staff": False, "ask_for_bill": False}})
    return {"ok": True}

@api.post("/sessions/{sid}/clear")
async def clear_session(sid: str, user=Depends(require_roles("owner", "waiter"))):
    """Force-close an open session (make the table free again). Does NOT record a payment."""
    session = await db.sessions.find_one({"id": sid}, {"_id": 0})
    if not session:
        raise HTTPException(404, "Session not found")
    if session.get("status") != "open":
        return {"ok": True, "already_closed": True}
    await db.sessions.update_one(
        {"id": sid},
        {"$set": {"status": "closed", "closed_at": now_iso(), "cleared_by": user["id"], "cleared_reason": "manual_clear"}},
    )
    await db.orders.update_many({"session_id": sid}, {"$set": {"status": "served", "closed": True}})
    await ws_manager.broadcast({"type": "session_closed", "session_id": sid})
    return {"ok": True}

@api.post("/tables/{table_id}/clear")
async def clear_table(table_id: str, user=Depends(require_roles("owner", "waiter"))):
    """Convenience: close any open session on this table. Idempotent."""
    session = await db.sessions.find_one({"table_id": table_id, "status": "open"}, {"_id": 0})
    if not session:
        return {"ok": True, "no_open_session": True}
    await db.sessions.update_one(
        {"id": session["id"]},
        {"$set": {"status": "closed", "closed_at": now_iso(), "cleared_by": user["id"], "cleared_reason": "manual_clear"}},
    )
    await db.orders.update_many({"session_id": session["id"]}, {"$set": {"status": "served", "closed": True}})
    await ws_manager.broadcast({"type": "session_closed", "session_id": session["id"]})
    return {"ok": True}

# ----------------------------- Orders -----------------------------
@api.post("/orders")
async def create_order(body: OrderIn):
    # Validate session
    session = await db.sessions.find_one({"id": body.session_id, "status": "open"}, {"_id": 0})
    if not session:
        raise HTTPException(400, "Session not open")
    # Build order lines with current price snapshot
    lines = []
    subtotal = 0.0
    for oi in body.items:
        item = await db.menu_items.find_one({"id": oi.item_id}, {"_id": 0})
        if not item:
            raise HTTPException(400, f"Item not found: {oi.item_id}")
        if not item.get("available", True):
            raise HTTPException(400, f"Item unavailable: {item['name_en']}")
        line = {
            "item_id": item["id"],
            "name_en": item["name_en"],
            "name_km": item.get("name_km", ""),
            "price": float(item["price"]),
            "quantity": oi.quantity,
            "note": oi.note,
            "status": "received",  # received -> preparing -> ready -> served
        }
        lines.append(line)
        subtotal += line["price"] * line["quantity"]

    order = {
        "id": str(uuid.uuid4()),
        "session_id": body.session_id,
        "table_id": body.table_id,
        "table_label": session["table_label"],
        "items": lines,
        "phone": body.phone,
        "guest_name": body.guest_name or "Guest",
        "status": "received",  # order-level
        "subtotal": subtotal,
        "created_at": now_iso(),
    }
    await db.orders.insert_one(order)
    order.pop("_id", None)
    await ws_manager.broadcast({"type": "new_order", "order": order})
    return order

@api.get("/orders")
async def list_orders(status: Optional[str] = None, user=Depends(get_current_user)):
    q = {}
    if status:
        q["status"] = status
    orders = await db.orders.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)
    return orders

@api.get("/orders/kitchen")
async def kitchen_orders(user=Depends(require_roles("owner", "kitchen", "waiter"))):
    orders = await db.orders.find(
        {"status": {"$in": ["received", "preparing"]}}, {"_id": 0}
    ).sort("created_at", 1).to_list(200)
    return orders

@api.post("/orders/clear-all")
async def clear_all_orders(mode: str = Query("active"), user=Depends(require_roles("owner", "waiter"))):
    """Bulk-clear orders. mode='active' marks all non-served orders as served.
    mode='all' does the same for every order regardless of status."""
    q = {} if mode == "all" else {"status": {"$ne": "served"}}
    orders = await db.orders.find(q, {"_id": 0, "id": 1, "items": 1}).to_list(2000)
    if not orders:
        return {"ok": True, "cleared": 0}
    for o in orders:
        new_items = [{**it, "status": "served"} for it in (o.get("items") or [])]
        await db.orders.update_one({"id": o["id"]}, {"$set": {"items": new_items, "status": "served", "closed": True}})
    await ws_manager.broadcast({"type": "orders_cleared", "count": len(orders)})
    return {"ok": True, "cleared": len(orders)}

@api.patch("/orders/{oid}/item/{idx}")
async def update_item_status(oid: str, idx: int, status: str = Query(...), user=Depends(require_roles("owner", "kitchen", "waiter"))):
    order = await db.orders.find_one({"id": oid}, {"_id": 0})
    if not order:
        raise HTTPException(404, "Order not found")
    if idx < 0 or idx >= len(order["items"]):
        raise HTTPException(400, "Bad index")
    order["items"][idx]["status"] = status
    # Order-level derived status
    statuses = [i["status"] for i in order["items"]]
    if all(s == "served" for s in statuses):
        order_status = "served"
    elif all(s in ("ready", "served") for s in statuses):
        order_status = "ready"
    elif any(s == "preparing" for s in statuses):
        order_status = "preparing"
    else:
        order_status = "received"
    order["status"] = order_status
    await db.orders.update_one({"id": oid}, {"$set": {"items": order["items"], "status": order_status}})
    await ws_manager.broadcast({"type": "order_updated", "order": order})
    return order

# ----------------------------- Payments -----------------------------
def make_qr_data_uri(payload: str) -> str:
    qr = qrcode.QRCode(border=1, box_size=8)
    qr.add_data(payload)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()

@api.post("/sessions/{sid}/pay")
async def pay(sid: str, method: str = Query(...)):
    """method: khqr | payway | cash"""
    session = await db.sessions.find_one({"id": sid, "status": "open"}, {"_id": 0})
    if not session:
        raise HTTPException(400, "Session not open")
    orders = await db.orders.find({"session_id": sid}, {"_id": 0}).to_list(500)
    total = sum(sum(i["price"] * i["quantity"] for i in o["items"]) for o in orders)
    if total <= 0:
        raise HTTPException(400, "No items to pay")

    settings = await db.settings.find_one({"id": "app"}, {"_id": 0}) or {}
    if method == "cash" and not settings.get("accept_cash", True):
        raise HTTPException(400, "Cash disabled")
    if method == "khqr" and not settings.get("accept_khqr", True):
        raise HTTPException(400, "KHQR disabled")
    if method not in ("cash", "khqr"):
        raise HTTPException(400, "Unsupported payment method")

    payment = {
        "id": str(uuid.uuid4()),
        "session_id": sid,
        "table_label": session["table_label"],
        "amount": round(total, 2),
        "currency": "USD",
        "method": method,
        "status": "pending",
        "created_at": now_iso(),
    }

    if method == "khqr":
        bill_no = "BBQ" + uuid.uuid4().hex[:10].upper()
        payment["qr_url"] = "/api/static/aba_khqr.jpg"
        payment["bill_number"] = bill_no
        payment["owner_name"] = os.environ.get("OWNER_KHQR_NAME", "")
        payment["khr_account"] = os.environ.get("OWNER_KHQR_KHR", "")
        payment["usd_account"] = os.environ.get("OWNER_KHQR_USD", "")
        payment["note"] = "After paying, tap 'I've paid' so the waiter can confirm."
    elif method == "cash":
        payment["note"] = "Waiter will confirm cash at the table."
    else:
        raise HTTPException(400, "Unknown method")

    await db.payments.insert_one(payment)
    payment.pop("_id", None)
    await ws_manager.broadcast({"type": "payment_created", "payment": payment})
    return payment

@api.get("/payments/{pid}")
async def get_payment(pid: str):
    p = await db.payments.find_one({"id": pid}, {"_id": 0})
    if not p:
        raise HTTPException(404, "Not found")
    return p

@api.post("/payments/{pid}/mock-confirm")
async def mock_confirm(pid: str):
    """Test-only: mark a KHQR or PayWay payment as paid. Also usable for customer 'I paid' in mock mode."""
    if PAYMENT_MODE != "mock":
        raise HTTPException(404, "Not available")
    p = await db.payments.find_one({"id": pid}, {"_id": 0})
    if not p:
        raise HTTPException(404, "Not found")
    await _finalize_payment(p)
    return {"ok": True}

@api.post("/payments/{pid}/confirm-cash")
async def confirm_cash(pid: str, user=Depends(require_roles("owner", "waiter"))):
    p = await db.payments.find_one({"id": pid}, {"_id": 0})
    if not p:
        raise HTTPException(404, "Not found")
    await _finalize_payment(p)
    return {"ok": True}

async def _finalize_payment(p: dict):
    await db.payments.update_one({"id": p["id"]}, {"$set": {"status": "paid", "paid_at": now_iso()}})
    # Close session and orders
    await db.sessions.update_one({"id": p["session_id"]}, {"$set": {"status": "closed", "closed_at": now_iso(), "paid_amount": p["amount"], "paid_method": p["method"]}})
    await db.orders.update_many({"session_id": p["session_id"]}, {"$set": {"status": "served", "closed": True}})
    await ws_manager.broadcast({"type": "session_closed", "session_id": p["session_id"]})

# ----------------------------- Receipts -----------------------------
async def _build_receipt(payment: dict) -> dict:
    sid = payment["session_id"]
    orders = await db.orders.find({"session_id": sid}, {"_id": 0}).to_list(500)
    settings = await db.settings.find_one({"id": "app"}, {"_id": 0}) or {}
    items = []
    subtotal = 0.0
    for o in orders:
        for it in o.get("items", []):
            line = round(it["price"] * it["quantity"], 2)
            subtotal += line
            items.append({
                "name_en": it.get("name_en", ""),
                "name_km": it.get("name_km", ""),
                "quantity": it["quantity"],
                "price": it["price"],
                "line_total": line,
                "note": it.get("note", ""),
            })
    guest = next((o.get("guest_name") for o in orders if o.get("guest_name")), "")
    phone = next((o.get("phone") for o in orders if o.get("phone")), "")
    receipt_id = payment.get("bill_number") or f"R-{payment['id'][:8].upper()}"
    return {
        "receipt_id": receipt_id,
        "payment_id": payment["id"],
        "session_id": sid,
        "restaurant_name": settings.get("restaurant_name", "BBQ Nights"),
        "table_label": payment.get("table_label", ""),
        "guest_name": guest,
        "phone": phone,
        "items": items,
        "subtotal": round(subtotal, 2),
        "total": round(payment.get("amount", subtotal), 2),
        "currency": payment.get("currency", "USD"),
        "method": payment.get("method", ""),
        "status": payment.get("status", ""),
        "created_at": payment.get("created_at"),
        "paid_at": payment.get("paid_at"),
    }

@api.get("/receipts/{pid}")
async def get_receipt(pid: str, user=Depends(require_roles("owner", "waiter"))):
    p = await db.payments.find_one({"id": pid}, {"_id": 0})
    if not p:
        raise HTTPException(404, "Receipt not found")
    return await _build_receipt(p)

@api.get("/receipts")
async def list_receipts(limit: int = 200, user=Depends(require_roles("owner", "waiter"))):
    paid = await db.payments.find({"status": "paid"}, {"_id": 0}).sort("paid_at", -1).to_list(limit)
    return [
        {
            "payment_id": p["id"],
            "receipt_id": p.get("bill_number") or f"R-{p['id'][:8].upper()}",
            "table_label": p.get("table_label", ""),
            "amount": p.get("amount", 0),
            "method": p.get("method", ""),
            "paid_at": p.get("paid_at"),
        }
        for p in paid
    ]

@api.delete("/receipts/{pid}")
async def delete_receipt(pid: str, user=Depends(require_roles("owner"))):
    res = await db.payments.delete_one({"id": pid, "status": "paid"})
    if res.deleted_count == 0:
        raise HTTPException(404, "Receipt not found")
    return {"ok": True, "deleted": pid}


# ----------------------------- Settings -----------------------------
@api.get("/settings")
async def get_settings():
    s = await db.settings.find_one({"id": "app"}, {"_id": 0})
    return s or {}

@api.put("/settings")
async def update_settings(body: SettingsIn, user=Depends(require_roles("owner"))):
    await db.settings.update_one({"id": "app"}, {"$set": body.model_dump()}, upsert=True)
    return {"ok": True}

# ----------------------------- Dashboard -----------------------------
@api.get("/dashboard/summary")
async def dashboard_summary(days: int = 7, user=Depends(require_roles("owner"))):
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    payments = await db.payments.find({"status": "paid", "paid_at": {"$gte": cutoff}}, {"_id": 0}).to_list(5000)
    revenue = sum(p["amount"] for p in payments)
    order_count = await db.orders.count_documents({"created_at": {"$gte": cutoff}})
    # Top items
    orders = await db.orders.find({"created_at": {"$gte": cutoff}}, {"_id": 0}).to_list(5000)
    item_agg = {}
    for o in orders:
        for it in o["items"]:
            k = it["name_en"]
            item_agg.setdefault(k, {"name": k, "qty": 0, "revenue": 0.0})
            item_agg[k]["qty"] += it["quantity"]
            item_agg[k]["revenue"] += it["price"] * it["quantity"]
    top = sorted(item_agg.values(), key=lambda x: x["qty"], reverse=True)[:10]
    # Revenue by day
    by_day = {}
    for p in payments:
        d = p["paid_at"][:10]
        by_day.setdefault(d, 0)
        by_day[d] += p["amount"]
    daily = sorted([{"date": k, "revenue": round(v, 2)} for k, v in by_day.items()], key=lambda x: x["date"])
    return {
        "revenue": round(revenue, 2),
        "order_count": order_count,
        "payment_count": len(payments),
        "top_items": top,
        "daily": daily,
    }

# ----------------------------- WebSocket -----------------------------
@app.websocket("/api/ws")
async def ws_endpoint(ws: WebSocket):
    await ws_manager.connect(ws)
    try:
        while True:
            await ws.receive_text()  # keep alive
    except WebSocketDisconnect:
        ws_manager.disconnect(ws)
    except Exception:
        ws_manager.disconnect(ws)

@api.get("/health")
async def health():
    return {"ok": True, "time": now_iso()}

# ----------------------------- Mount -----------------------------
app.include_router(api)
app.mount("/api/static", StaticFiles(directory=str(ROOT_DIR / "static")), name="static")

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown():
    client.close()
