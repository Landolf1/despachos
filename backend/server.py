from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, timezone
from supabase import create_client, Client
import pandas as pd
from io import BytesIO
from fastapi.responses import StreamingResponse


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Supabase configuration
SUPABASE_URL = "https://zptfgrmjfnadngrqeakx.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpwdGZncm1qZm5hZG5ncnFlYWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkxNjg3NDYsImV4cCI6MjA3NDc0NDc0Nn0.wpB93p-_MR7pCAwFVUbeCt8a0uyZmdrBwwvjr8YTP5Q"

# Initialize Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Create the main app
app = FastAPI(title="Sistema de Control de Despachos - Supabase")

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
    card_type: str  # "Masivas", "Débito", "Tracking"

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

# Helper functions
def prepare_datetime_for_supabase(dt):
    if isinstance(dt, datetime):
        return dt.isoformat()
    return dt

def parse_datetime_from_supabase(dt_str):
    if isinstance(dt_str, str):
        return datetime.fromisoformat(dt_str.replace('Z', '+00:00'))
    return dt_str

# Initialize database tables (run once)
async def init_database():
    try:
        # Create messengers table if not exists
        messengers_table = supabase.table('messengers').select('id').limit(1).execute()
        
        # Create dispatches table if not exists  
        dispatches_table = supabase.table('dispatches').select('id').limit(1).execute()
        
        # Create dispatch_items table if not exists
        dispatch_items_table = supabase.table('dispatch_items').select('id').limit(1).execute()
        
        logging.info("Database tables verified successfully")
    except Exception as e:
        logging.warning(f"Database table verification: {str(e)}")

# Messenger endpoints
@api_router.post("/messengers", response_model=Messenger)
async def create_messenger(messenger_data: MessengerCreate):
    try:
        messenger = Messenger(**messenger_data.dict())
        
        # Insert into Supabase
        result = supabase.table('messengers').insert({
            'id': messenger.id,
            'name': messenger.name,
            'contact_number': messenger.contact_number,
            'created_at': prepare_datetime_for_supabase(messenger.created_at)
        }).execute()
        
        if result.data:
            return messenger
        else:
            raise HTTPException(status_code=500, detail="Error creating messenger")
    except Exception as e:
        logging.error(f"Error creating messenger: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/messengers", response_model=List[Messenger])
async def get_messengers():
    try:
        result = supabase.table('messengers').select('*').order('created_at', desc=True).execute()
        
        messengers = []
        for item in result.data:
            messenger = Messenger(
                id=item['id'],
                name=item['name'],
                contact_number=item['contact_number'],
                created_at=parse_datetime_from_supabase(item['created_at'])
            )
            messengers.append(messenger)
        
        return messengers
    except Exception as e:
        logging.error(f"Error fetching messengers: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/messengers/{messenger_id}", response_model=Messenger)
async def get_messenger(messenger_id: str):
    try:
        result = supabase.table('messengers').select('*').eq('id', messenger_id).single().execute()
        
        if result.data:
            item = result.data
            return Messenger(
                id=item['id'],
                name=item['name'],
                contact_number=item['contact_number'],
                created_at=parse_datetime_from_supabase(item['created_at'])
            )
        else:
            raise HTTPException(status_code=404, detail="Mensajero no encontrado")
    except Exception as e:
        logging.error(f"Error fetching messenger: {str(e)}")
        raise HTTPException(status_code=404, detail="Mensajero no encontrado")

@api_router.delete("/messengers/{messenger_id}")
async def delete_messenger(messenger_id: str):
    try:
        result = supabase.table('messengers').delete().eq('id', messenger_id).execute()
        
        if result.data:
            return {"message": "Mensajero eliminado exitosamente"}
        else:
            raise HTTPException(status_code=404, detail="Mensajero no encontrado")
    except Exception as e:
        logging.error(f"Error deleting messenger: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Dispatch endpoints
@api_router.post("/dispatches", response_model=Dispatch)
async def create_dispatch(dispatch_data: DispatchCreate):
    try:
        # Get messenger info
        messenger_result = supabase.table('messengers').select('*').eq('id', dispatch_data.messenger_id).single().execute()
        
        if not messenger_result.data:
            raise HTTPException(status_code=404, detail="Mensajero no encontrado")
        
        messenger = messenger_result.data
        
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
        
        # Insert dispatch into Supabase
        dispatch_result = supabase.table('dispatches').insert({
            'id': dispatch.id,
            'messenger_id': dispatch.messenger_id,
            'messenger_name': dispatch.messenger_name,
            'total_cards': dispatch.total_cards,
            'created_at': prepare_datetime_for_supabase(dispatch.created_at),
            'date': dispatch.date
        }).execute()
        
        if not dispatch_result.data:
            raise HTTPException(status_code=500, detail="Error creating dispatch")
        
        # Insert dispatch items
        for item in dispatch.items:
            supabase.table('dispatch_items').insert({
                'id': str(uuid.uuid4()),
                'dispatch_id': dispatch.id,
                'card_number': item.card_number,
                'card_type': item.card_type
            }).execute()
        
        return dispatch
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error creating dispatch: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/dispatches", response_model=List[Dispatch])
async def get_dispatches(date: Optional[str] = None, messenger_id: Optional[str] = None):
    try:
        query = supabase.table('dispatches').select('*')
        
        if date:
            query = query.eq('date', date)
        if messenger_id:
            query = query.eq('messenger_id', messenger_id)
        
        result = query.order('created_at', desc=True).execute()
        
        dispatches = []
        for dispatch_data in result.data:
            # Get dispatch items
            items_result = supabase.table('dispatch_items').select('*').eq('dispatch_id', dispatch_data['id']).execute()
            
            items = [DispatchItem(card_number=item['card_number'], card_type=item['card_type']) for item in items_result.data]
            
            dispatch = Dispatch(
                id=dispatch_data['id'],
                messenger_id=dispatch_data['messenger_id'],
                messenger_name=dispatch_data['messenger_name'],
                items=items,
                total_cards=dispatch_data['total_cards'],
                created_at=parse_datetime_from_supabase(dispatch_data['created_at']),
                date=dispatch_data['date']
            )
            dispatches.append(dispatch)
        
        return dispatches
        
    except Exception as e:
        logging.error(f"Error fetching dispatches: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/dispatches/today", response_model=List[Dispatch])
async def get_today_dispatches():
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    return await get_dispatches(date=today)

@api_router.get("/reports/daily")
async def get_daily_report(date: Optional[str] = None):
    try:
        if not date:
            date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        
        # Get all dispatches for the date
        dispatches = await get_dispatches(date=date)
        
        # Group by messenger
        messenger_reports = {}
        for dispatch in dispatches:
            messenger_id = dispatch.messenger_id
            if messenger_id not in messenger_reports:
                messenger_reports[messenger_id] = {
                    "messenger_name": dispatch.messenger_name,
                    "total_cards": 0,
                    "dispatches": []
                }
            
            messenger_reports[messenger_id]["total_cards"] += dispatch.total_cards
            messenger_reports[messenger_id]["dispatches"].append({
                "id": dispatch.id,
                "time": dispatch.created_at.isoformat(),
                "cards": dispatch.total_cards,
                "items": [item.dict() for item in dispatch.items]
            })
        
        # Get messenger contact info
        for messenger_id, report in messenger_reports.items():
            try:
                messenger_result = supabase.table('messengers').select('contact_number').eq('id', messenger_id).single().execute()
                if messenger_result.data:
                    report["messenger_contact"] = messenger_result.data["contact_number"]
                else:
                    report["messenger_contact"] = "No disponible"
            except:
                report["messenger_contact"] = "No disponible"
        
        return {
            "date": date,
            "total_messengers": len(messenger_reports),
            "total_dispatches": len(dispatches),
            "total_cards": sum(r["total_cards"] for r in messenger_reports.values()),
            "messengers": messenger_reports
        }
        
    except Exception as e:
        logging.error(f"Error generating daily report: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/reports/export-excel")
async def export_daily_report_excel(date: Optional[str] = None):
    try:
        if not date:
            date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        
        # Get report data
        report = await get_daily_report(date)
        
        # Create Excel file
        output = BytesIO()
        
        # Create DataFrames - One sheet per messenger
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            # Summary sheet
            summary_data = {
                'Métrica': ['Fecha', 'Total Mensajeros', 'Total Despachos', 'Total Tarjetas'],
                'Valor': [report['date'], report['total_messengers'], report['total_dispatches'], report['total_cards']]
            }
            pd.DataFrame(summary_data).to_excel(writer, sheet_name='Resumen', index=False)
            
            # Create one sheet per messenger
            for messenger_id, messenger_data in report['messengers'].items():
                messenger_name = messenger_data['messenger_name'].replace('/', '_')  # Clean sheet name
                sheet_name = f"{messenger_name[:25]}"  # Limit sheet name length
                
                detail_data = []
                for dispatch in messenger_data['dispatches']:
                    for item in dispatch['items']:
                        detail_data.append({
                            'Mensajero': messenger_data['messenger_name'],
                            'Contacto': messenger_data['messenger_contact'],
                            'Fecha': date,
                            'Hora': dispatch['time'].split('T')[1].split('.')[0],
                            'Número Tarjeta': item['card_number'],
                            'Tipo Tarjeta': item['card_type']
                        })
                
                if detail_data:
                    df = pd.DataFrame(detail_data)
                    
                    # Add summary at the top
                    summary_row = pd.DataFrame([{
                        'Mensajero': f"RESUMEN - {messenger_data['messenger_name']}",
                        'Contacto': f"Total Tarjetas: {messenger_data['total_cards']}",
                        'Fecha': f"Despachos: {len(messenger_data['dispatches'])}",
                        'Hora': '',
                        'Número Tarjeta': '',
                        'Tipo Tarjeta': ''
                    }])
                    
                    # Add empty row
                    empty_row = pd.DataFrame([{col: '' for col in df.columns}])
                    
                    # Combine summary + empty + data
                    final_df = pd.concat([summary_row, empty_row, df], ignore_index=True)
                    final_df.to_excel(writer, sheet_name=sheet_name, index=False)
        
        output.seek(0)
        
        # Return Excel file
        headers = {
            'Content-Disposition': f'attachment; filename=reporte_despachos_{date}.xlsx'
        }
        
        return StreamingResponse(
            BytesIO(output.read()),
            media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            headers=headers
        )
        
    except Exception as e:
        logging.error(f"Error exporting Excel: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/")
async def root():
    return {"message": "Sistema de Control de Despachos API - Supabase"}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("startup")
async def startup_event():
    await init_database()
