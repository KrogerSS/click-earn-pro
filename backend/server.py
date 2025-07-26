from fastapi import FastAPI, HTTPException, Request, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pymongo import MongoClient
from pymongo.errors import DuplicateKeyError
import os
from datetime import datetime, timedelta
import uuid
import httpx
from typing import Optional
import json
import hashlib
import random
import re
from pydantic import BaseModel, EmailStr, validator

# Initialize FastAPI app
app = FastAPI()

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# MongoDB connection
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'clickearn_pro')

client = MongoClient(MONGO_URL)
db = client[DB_NAME]

# Collections
users_collection = db.users
sessions_collection = db.sessions
clicks_collection = db.clicks
withdrawals_collection = db.withdrawals
verification_codes_collection = db.verification_codes

# Pydantic models
class ClickData(BaseModel):
    content_id: str

class VideoWatchData(BaseModel):
    video_id: str
    watch_duration: int  # in seconds

class WithdrawRequest(BaseModel):
    amount: float
    paypal_email: str

class UserRegister(BaseModel):
    name: str
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    password: str
    
    @validator('email', 'phone')
    def email_or_phone_required(cls, v, values):
        if not values.get('email') and not values.get('phone'):
            raise ValueError('Email ou telefone é obrigatório')
        return v
    
    @validator('phone')
    def validate_phone(cls, v):
        if v and not re.match(r'^\+?[\d\s\-\(\)]{10,}$', v):
            raise ValueError('Formato de telefone inválido')
        return v

class UserLogin(BaseModel):
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    password: str

class VerifyCodeRequest(BaseModel):
    phone: str
    code: str

class SendCodeRequest(BaseModel):
    phone: str

# Utility functions
def hash_password(password: str) -> str:
    """Hash password using SHA256"""
    return hashlib.sha256(password.encode()).hexdigest()

def verify_password(password: str, hashed: str) -> bool:
    """Verify password against hash"""
    return hash_password(password) == hashed

def generate_verification_code() -> str:
    """Generate 6-digit verification code"""
    return str(random.randint(100000, 999999))

def create_session(user_id: str) -> str:
    """Create new session for user"""
    session_id = str(uuid.uuid4())
    session_data = {
        "session_id": session_id,
        "user_id": user_id,
        "created_at": datetime.now(),
        "expires_at": datetime.now() + timedelta(days=7)
    }
    
    # Remove existing sessions for user
    sessions_collection.delete_many({"user_id": user_id})
    sessions_collection.insert_one(session_data)
    
    return session_id

# Authentication dependency
async def get_current_user(x_session_id: str = Header(None)):
    if not x_session_id:
        raise HTTPException(status_code=401, detail="Session ID required")
    
    session = sessions_collection.find_one({"session_id": x_session_id})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    
    # Check session expiry
    if datetime.now() > session["expires_at"]:
        sessions_collection.delete_one({"session_id": x_session_id})
        raise HTTPException(status_code=401, detail="Session expired")
    
    user = users_collection.find_one({"user_id": session["user_id"]})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    return user

@app.get("/")
async def root():
    return {"message": "ClickEarn Pro API", "status": "running"}

# Email/Phone Registration and Login
@app.post("/api/auth/register")
async def register_user(user_data: UserRegister):
    try:
        # Check if user already exists
        existing_user = None
        if user_data.email:
            existing_user = users_collection.find_one({"email": user_data.email})
        if not existing_user and user_data.phone:
            existing_user = users_collection.find_one({"phone": user_data.phone})
        
        if existing_user:
            raise HTTPException(status_code=400, detail="Usuário já existe")
        
        # Create new user
        user_id = str(uuid.uuid4())
        new_user = {
            "user_id": user_id,
            "name": user_data.name,
            "email": user_data.email,
            "phone": user_data.phone,
            "password": hash_password(user_data.password),
            "balance": 0.0,
            "total_earned": 0.0,
            "clicks_today": 0,
            "videos_today": 0,
            "last_click_date": None,
            "last_video_date": None,
            "created_at": datetime.now(),
            "is_active": True,
            "auth_method": "email_phone",
            "phone_verified": False,
            "email_verified": False
        }
        
        users_collection.insert_one(new_user)
        
        # Create session
        session_id = create_session(user_id)
        
        return {
            "success": True,
            "message": "Usuário registrado com sucesso",
            "user": {
                "user_id": user_id,
                "name": new_user["name"],
                "email": new_user["email"],
                "phone": new_user["phone"],
                "balance": new_user["balance"],
                "total_earned": new_user["total_earned"]
            },
            "session_id": session_id
        }
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/auth/login")
async def login_user(login_data: UserLogin):
    try:
        # Find user by email or phone
        user = None
        if login_data.email:
            user = users_collection.find_one({"email": login_data.email})
        elif login_data.phone:
            user = users_collection.find_one({"phone": login_data.phone})
        
        if not user:
            raise HTTPException(status_code=401, detail="Usuário não encontrado")
        
        if not verify_password(login_data.password, user["password"]):
            raise HTTPException(status_code=401, detail="Senha incorreta")
        
        if not user.get("is_active", True):
            raise HTTPException(status_code=401, detail="Conta desativada")
        
        # Create session
        session_id = create_session(user["user_id"])
        
        return {
            "success": True,
            "message": "Login realizado com sucesso",
            "user": {
                "user_id": user["user_id"],
                "name": user["name"],
                "email": user.get("email"),
                "phone": user.get("phone"),
                "balance": user["balance"],
                "total_earned": user["total_earned"]
            },
            "session_id": session_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/auth/send-code")
async def send_verification_code(request: SendCodeRequest):
    try:
        # Generate verification code
        code = generate_verification_code()
        
        # Store code in database (expires in 5 minutes)
        verification_data = {
            "phone": request.phone,
            "code": code,
            "created_at": datetime.now(),
            "expires_at": datetime.now() + timedelta(minutes=5),
            "used": False
        }
        
        # Remove old codes for this phone
        verification_codes_collection.delete_many({"phone": request.phone})
        verification_codes_collection.insert_one(verification_data)
        
        # In production, send SMS here
        # For demo, we'll return the code (remove in production!)
        return {
            "success": True,
            "message": "Código enviado por SMS",
            "demo_code": code  # Remove this in production!
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/auth/verify-code")
async def verify_phone_code(request: VerifyCodeRequest):
    try:
        # Find verification code
        verification = verification_codes_collection.find_one({
            "phone": request.phone,
            "code": request.code,
            "used": False
        })
        
        if not verification:
            raise HTTPException(status_code=400, detail="Código inválido")
        
        if datetime.now() > verification["expires_at"]:
            raise HTTPException(status_code=400, detail="Código expirado")
        
        # Mark code as used
        verification_codes_collection.update_one(
            {"_id": verification["_id"]},
            {"$set": {"used": True}}
        )
        
        # Update user phone verification status
        users_collection.update_one(
            {"phone": request.phone},
            {"$set": {"phone_verified": True}}
        )
        
        return {
            "success": True,
            "message": "Telefone verificado com sucesso"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Emergent Auth (existing)
@app.post("/api/auth/profile")
async def authenticate_user(request: Request):
    try:
        # Get session ID from headers
        session_id = request.headers.get("X-Session-ID")
        if not session_id:
            raise HTTPException(status_code=400, detail="Session ID required")
        
        # Call Emergent auth API
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                headers={"X-Session-ID": session_id}
            )
            
            if response.status_code != 200:
                raise HTTPException(status_code=401, detail="Invalid session")
            
            auth_data = response.json()
        
        # Check if user exists
        existing_user = users_collection.find_one({"email": auth_data["email"]})
        
        if not existing_user:
            # Create new user
            user_data = {
                "user_id": str(uuid.uuid4()),
                "email": auth_data["email"],
                "name": auth_data["name"],
                "picture": auth_data.get("picture", ""),
                "balance": 0.0,
                "total_earned": 0.0,
                "clicks_today": 0,
                "videos_today": 0,
                "last_click_date": None,
                "last_video_date": None,
                "created_at": datetime.now(),
                "is_active": True,
                "auth_method": "google",
                "phone_verified": False,
                "email_verified": True
            }
            users_collection.insert_one(user_data)
            user = user_data
        else:
            user = existing_user
        
        # Create session
        session_data = {
            "session_id": session_id,
            "user_id": user["user_id"],
            "session_token": auth_data["session_token"],
            "created_at": datetime.now(),
            "expires_at": datetime.now() + timedelta(days=7)
        }
        
        # Replace existing session if any
        sessions_collection.delete_many({"user_id": user["user_id"]})
        sessions_collection.insert_one(session_data)
        
        return {
            "user": {
                "user_id": user["user_id"],
                "email": user["email"],
                "name": user["name"],
                "picture": user.get("picture", ""),
                "balance": user["balance"],
                "total_earned": user["total_earned"]
            },
            "session_token": auth_data["session_token"]
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/dashboard")
async def get_dashboard(current_user = Depends(get_current_user)):
    # Reset daily clicks if new day
    today = datetime.now().date()
    last_click_date = current_user.get("last_click_date")
    last_video_date = current_user.get("last_video_date")
    
    updates = {}
    if last_click_date and last_click_date.date() != today:
        updates["clicks_today"] = 0
    if last_video_date and last_video_date.date() != today:
        updates["videos_today"] = 0
        
    if updates:
        users_collection.update_one(
            {"user_id": current_user["user_id"]},
            {"$set": updates}
        )
        current_user.update(updates)
    
    # Get today's earnings
    today_clicks = clicks_collection.count_documents({
        "user_id": current_user["user_id"],
        "created_at": {"$gte": datetime.combine(today, datetime.min.time())}
    })
    
    today_earnings = today_clicks * 0.5
    
    # Get recent activity
    recent_clicks = list(clicks_collection.find(
        {"user_id": current_user["user_id"]},
        {"_id": 0}
    ).sort("created_at", -1).limit(10))
    
    return {
        "user": {
            "name": current_user["name"],
            "email": current_user.get("email"),
            "phone": current_user.get("phone"),
            "picture": current_user.get("picture", "")
        },
        "balance": current_user["balance"],
        "total_earned": current_user["total_earned"],
        "clicks_today": current_user.get("clicks_today", 0),
        "videos_today": current_user.get("videos_today", 0),
        "clicks_remaining": max(0, 20 - current_user.get("clicks_today", 0)),
        "videos_remaining": max(0, 10 - current_user.get("videos_today", 0)),
        "today_earnings": today_earnings,
        "recent_activity": recent_clicks
    }

@app.post("/api/click")
async def process_click(click_data: ClickData, current_user = Depends(get_current_user)):
    # Check daily limit
    today = datetime.now().date()
    last_click_date = current_user.get("last_click_date")
    
    # Reset daily clicks if new day
    if not last_click_date or last_click_date.date() != today:
        users_collection.update_one(
            {"user_id": current_user["user_id"]},
            {"$set": {"clicks_today": 0, "last_click_date": datetime.now()}}
        )
        current_user["clicks_today"] = 0
    
    if current_user.get("clicks_today", 0) >= 20:
        raise HTTPException(status_code=400, detail="Limite diário de cliques atingido")
    
    # Process valid click
    click_record = {
        "click_id": str(uuid.uuid4()),
        "user_id": current_user["user_id"],
        "content_id": click_data.content_id,
        "amount": 0.5,
        "created_at": datetime.now(),
        "ip_address": "127.0.0.1"  # In production, get real IP
    }
    
    clicks_collection.insert_one(click_record)
    
    # Update user stats
    new_balance = current_user["balance"] + 0.5
    new_total = current_user["total_earned"] + 0.5
    new_clicks = current_user.get("clicks_today", 0) + 1
    
    users_collection.update_one(
        {"user_id": current_user["user_id"]},
        {
            "$set": {
                "balance": new_balance,
                "total_earned": new_total,
                "clicks_today": new_clicks,
                "last_click_date": datetime.now()
            }
        }
    )
    
    return {
        "success": True,
        "amount_earned": 0.5,
        "new_balance": new_balance,
        "clicks_remaining": max(0, 20 - new_clicks),
        "message": "Clique válido! $0.50 adicionado ao seu saldo."
    }

@app.post("/api/video/complete")
async def complete_video(video_data: VideoWatchData, current_user = Depends(get_current_user)):
    # Check daily limit
    today = datetime.now().date()
    last_video_date = current_user.get("last_video_date")
    
    # Reset daily videos if new day
    if not last_video_date or last_video_date.date() != today:
        users_collection.update_one(
            {"user_id": current_user["user_id"]},
            {"$set": {"videos_today": 0, "last_video_date": datetime.now()}}
        )
        current_user["videos_today"] = 0
    
    if current_user.get("videos_today", 0) >= 10:
        raise HTTPException(status_code=400, detail="Limite diário de vídeos atingido")
    
    # Validate minimum watch duration (30 seconds for reward)
    if video_data.watch_duration < 30:
        raise HTTPException(status_code=400, detail="Vídeo deve ser assistido por pelo menos 30 segundos")
    
    # Process valid video completion
    video_record = {
        "video_id": video_data.video_id,
        "user_id": current_user["user_id"],
        "watch_duration": video_data.watch_duration,
        "amount": 0.25,
        "created_at": datetime.now(),
        "ip_address": "127.0.0.1"
    }
    
    clicks_collection.insert_one(video_record)  # Reusing clicks collection for simplicity
    
    # Update user stats
    new_balance = current_user["balance"] + 0.25
    new_total = current_user["total_earned"] + 0.25
    new_videos = current_user.get("videos_today", 0) + 1
    
    users_collection.update_one(
        {"user_id": current_user["user_id"]},
        {
            "$set": {
                "balance": new_balance,
                "total_earned": new_total,
                "videos_today": new_videos,
                "last_video_date": datetime.now()
            }
        }
    )
    
    return {
        "success": True,
        "amount_earned": 0.25,
        "new_balance": new_balance,
        "videos_remaining": max(0, 10 - new_videos),
        "message": "Vídeo assistido! $0.25 adicionado ao seu saldo."
    }

@app.get("/api/videos")
async def get_videos():
    # Mock video ads data
    videos = [
        {
            "id": "video_1",
            "title": "Anúncio - Produto Incrível",
            "duration": 30,
            "thumbnail": "https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=300&h=200&fit=crop",
            "earnings": 0.25,
            "description": "Assista este vídeo promocional por 30 segundos"
        },
        {
            "id": "video_2",
            "title": "Anúncio - Serviço Premium",
            "duration": 45,
            "thumbnail": "https://images.unsplash.com/photo-1551650975-87deedd944c3?w=300&h=200&fit=crop",
            "earnings": 0.25,
            "description": "Vídeo publicitário de 45 segundos"
        },
        {
            "id": "video_3",
            "title": "Anúncio - App Mobile",
            "duration": 60,
            "thumbnail": "https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=300&h=200&fit=crop",
            "earnings": 0.25,
            "description": "Descubra este novo aplicativo"
        }
    ]
    
    return {"videos": videos}

@app.get("/api/withdraw-history")
async def get_withdraw_history(current_user = Depends(get_current_user)):
    withdrawals = list(withdrawals_collection.find(
        {"user_id": current_user["user_id"]},
        {"_id": 0}
    ).sort("created_at", -1))
    
    return {"withdrawals": withdrawals}

@app.post("/api/withdraw")
async def request_withdrawal(withdraw_data: WithdrawRequest, current_user = Depends(get_current_user)):
    if withdraw_data.amount < 10:
        raise HTTPException(status_code=400, detail="Valor mínimo de saque é $10.00")
    
    if withdraw_data.amount > current_user["balance"]:
        raise HTTPException(status_code=400, detail="Saldo insuficiente")
    
    # Create withdrawal request
    withdrawal_record = {
        "withdrawal_id": str(uuid.uuid4()),
        "user_id": current_user["user_id"],
        "amount": withdraw_data.amount,
        "paypal_email": withdraw_data.paypal_email,
        "status": "pending",
        "created_at": datetime.now(),
        "processed_at": None
    }
    
    withdrawals_collection.insert_one(withdrawal_record)
    
    # Update user balance
    new_balance = current_user["balance"] - withdraw_data.amount
    users_collection.update_one(
        {"user_id": current_user["user_id"]},
        {"$set": {"balance": new_balance}}
    )
    
    return {
        "success": True,
        "withdrawal_id": withdrawal_record["withdrawal_id"],
        "message": f"Solicitação de saque de ${withdraw_data.amount} enviada. Processamento em até 24h.",
        "new_balance": new_balance
    }

@app.get("/api/content")
async def get_content():
    # Mock content for clicking
    content_items = [
        {
            "id": "content_1",
            "title": "Artigo sobre Tecnologia",
            "description": "Descubra as últimas tendências em tecnologia",
            "image": "https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=300&h=200&fit=crop",
            "earnings": 0.5
        },
        {
            "id": "content_2", 
            "title": "Dicas de Investimento",
            "description": "Como investir seu dinheiro de forma inteligente",
            "image": "https://images.unsplash.com/photo-1559526324-593bc073d938?w=300&h=200&fit=crop",
            "earnings": 0.5
        },
        {
            "id": "content_3",
            "title": "Saúde e Bem-estar",
            "description": "Mantenha-se saudável com essas dicas",
            "image": "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=300&h=200&fit=crop",
            "earnings": 0.5
        },
        {
            "id": "content_4",
            "title": "Receitas Deliciosas",
            "description": "Aprenda a fazer pratos incríveis",
            "image": "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=300&h=200&fit=crop",
            "earnings": 0.5
        }
    ]
    
    return {"content": content_items}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)