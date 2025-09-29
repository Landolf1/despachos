from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, timezone


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI(title="Sistema de Control de Despachos")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


# Define Models
class Messenger(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    contact_number: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class MessengerCreate(BaseModel):
    name: str
    contact_number: str

class DispatchItem(BaseModel):
    card_number: str
    client_number: str

class Dispatch(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    messenger_id: str
    messenger_name: str
    items: List[DispatchItem]
    total_cards: int
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    date: str  # YYYY-MM-DD format for easy filtering

class DispatchCreate(BaseModel):
    messenger_id: str
    items: List[DispatchItem]

class DispatchReport(BaseModel):
    date: str
    messenger_name: str
    messenger_contact: str
    total_cards: int
    dispatches: List[dict]

# Helper functions
def prepare_for_mongo(data):
    if isinstance(data, dict):
        if 'created_at' in data and isinstance(data['created_at'], datetime):
            data['created_at'] = data['created_at'].isoformat()
        if 'date' in data and isinstance(data['date'], str):
            pass  # Already string
    return data

def parse_from_mongo(item):
    if isinstance(item, dict):
        if 'created_at' in item and isinstance(item['created_at'], str):
            item['created_at'] = datetime.fromisoformat(item['created_at'])
        if '_id' in item:
            del item['_id']  # Remove MongoDB ObjectId
    return item

# Messenger endpoints
@api_router.post("/messengers", response_model=Messenger)
async def create_messenger(messenger_data: MessengerCreate):
    messenger = Messenger(**messenger_data.dict())
    messenger_dict = prepare_for_mongo(messenger.dict())
    await db.messengers.insert_one(messenger_dict)
    return messenger

@api_router.get("/messengers", response_model=List[Messenger])
async def get_messengers():
    messengers = await db.messengers.find().to_list(1000)
    return [Messenger(**parse_from_mongo(m)) for m in messengers]

@api_router.get("/messengers/{messenger_id}", response_model=Messenger)
async def get_messenger(messenger_id: str):
    messenger = await db.messengers.find_one({"id": messenger_id})
    if not messenger:
        raise HTTPException(status_code=404, detail="Mensajero no encontrado")
    return Messenger(**parse_from_mongo(messenger))

@api_router.delete("/messengers/{messenger_id}")
async def delete_messenger(messenger_id: str):
    result = await db.messengers.delete_one({"id": messenger_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Mensajero no encontrado")
    return {"message": "Mensajero eliminado exitosamente"}

# Dispatch endpoints
@api_router.post("/dispatches", response_model=Dispatch)
async def create_dispatch(dispatch_data: DispatchCreate):
    # Get messenger info
    messenger = await db.messengers.find_one({"id": dispatch_data.messenger_id})
    if not messenger:
        raise HTTPException(status_code=404, detail="Mensajero no encontrado")
    
    # Create dispatch
    now = datetime.now(timezone.utc)
    dispatch = Dispatch(
        messenger_id=dispatch_data.messenger_id,
        messenger_name=messenger["name"],
        items=dispatch_data.items,
        total_cards=len(dispatch_data.items),
        created_at=now,
        date=now.strftime("%Y-%m-%d")
    )
    
    dispatch_dict = prepare_for_mongo(dispatch.dict())
    await db.dispatches.insert_one(dispatch_dict)
    return dispatch

@api_router.get("/dispatches", response_model=List[Dispatch])
async def get_dispatches(date: Optional[str] = None, messenger_id: Optional[str] = None):
    query = {}
    if date:
        query["date"] = date
    if messenger_id:
        query["messenger_id"] = messenger_id
    
    dispatches = await db.dispatches.find(query).sort("created_at", -1).to_list(1000)
    return [Dispatch(**parse_from_mongo(d)) for d in dispatches]

@api_router.get("/dispatches/today", response_model=List[Dispatch])
async def get_today_dispatches():
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    dispatches = await db.dispatches.find({"date": today}).sort("created_at", -1).to_list(1000)
    return [Dispatch(**parse_from_mongo(d)) for d in dispatches]

@api_router.get("/reports/daily")
async def get_daily_report(date: Optional[str] = None):
    if not date:
        date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    # Get all dispatches for the date
    dispatches = await db.dispatches.find({"date": date}).to_list(1000)
    
    # Group by messenger
    messenger_reports = {}
    for dispatch in dispatches:
        messenger_id = dispatch["messenger_id"]
        if messenger_id not in messenger_reports:
            messenger_reports[messenger_id] = {
                "messenger_name": dispatch["messenger_name"],
                "total_cards": 0,
                "dispatches": []
            }
        
        messenger_reports[messenger_id]["total_cards"] += dispatch["total_cards"]
        messenger_reports[messenger_id]["dispatches"].append({
            "id": dispatch["id"],
            "time": dispatch["created_at"],
            "cards": dispatch["total_cards"],
            "items": dispatch["items"]
        })
    
    # Get messenger contact info
    for messenger_id, report in messenger_reports.items():
        messenger = await db.messengers.find_one({"id": messenger_id})
        if messenger:
            report["messenger_contact"] = messenger["contact_number"]
        else:
            report["messenger_contact"] = "No disponible"
    
    return {
        "date": date,
        "total_messengers": len(messenger_reports),
        "total_dispatches": len(dispatches),
        "total_cards": sum(r["total_cards"] for r in messenger_reports.values()),
        "messengers": messenger_reports
    }

@api_router.get("/")
async def root():
    return {"message": "Sistema de Control de Despachos API"}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
