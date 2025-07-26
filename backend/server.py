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
from pydantic import BaseModel

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

# Pydantic models
class ClickData(BaseModel):
    content_id: str

class WithdrawRequest(BaseModel):
    amount: float
    paypal_email: str

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
                "last_click_date": None,
                "created_at": datetime.now(),
                "is_active": True
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
                "picture": user["picture"],
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
    
    if last_click_date and last_click_date.date() != today:
        users_collection.update_one(
            {"user_id": current_user["user_id"]},
            {"$set": {"clicks_today": 0}}
        )
        current_user["clicks_today"] = 0
    
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
            "email": current_user["email"],
            "picture": current_user["picture"]
        },
        "balance": current_user["balance"],
        "total_earned": current_user["total_earned"],
        "clicks_today": current_user["clicks_today"],
        "clicks_remaining": max(0, 20 - current_user["clicks_today"]),
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
    
    if current_user["clicks_today"] >= 20:
        raise HTTPException(status_code=400, detail="Daily click limit reached")
    
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
    new_clicks = current_user["clicks_today"] + 1
    
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