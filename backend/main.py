import os
import math
import uuid
import logging
import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional

import powerbi_semantic
from chat_agent import get_dashboard_agent

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("dashboard")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    import time
    start = time.time()
    response = await call_next(request)
    duration_ms = (time.time() - start) * 1000
    logger.info(
        f"{request.method} {request.url.path} "
        f"params={dict(request.query_params)} "
        f"-> {response.status_code} ({duration_ms:.0f}ms)"
    )
    return response


# Load data on startup
DATA_FILE = os.path.join(os.path.dirname(__file__), "Financial_Data.csv")

def load_data():
    if not os.path.exists(DATA_FILE):
        return pd.DataFrame()
    
    df = pd.read_csv(DATA_FILE)
    # Strip whitespace from column names
    df.columns = df.columns.str.strip()
    
    # Strip whitespace from string columns
    str_cols = ['Segment', 'Country', 'Product', 'Discount Band', 'Month Name']
    for col in str_cols:
        if col in df.columns:
            df[col] = df[col].astype(str).str.strip()
            
    # Clean currency columns to float
    currency_cols = ['Manufacturing Price', 'Sale Price', 'Gross Sales', 'Discounts', 'Sales', 'COGS', 'Profit']
    for col in currency_cols:
        if col in df.columns:
            # Handle possible string representation of currency e.g., "$1,234.56", "(100.00)", " $-   "
            # Remove '$', ',', and spaces. Replace '(' and ')' for negatives
            cleaned = df[col].astype(str).str.replace('$', '', regex=False).str.replace(',', '', regex=False).str.strip()
            cleaned = cleaned.str.replace(r'^\((.*)\)$', r'-\1', regex=True) # (100) -> -100
            df[col] = pd.to_numeric(cleaned, errors='coerce').fillna(0.0)
            
    # Parse Date
    if 'Date' in df.columns:
        df['Date'] = pd.to_datetime(df['Date'], errors='coerce')
        
    return df

df_global = load_data()

def get_filtered_df(
    year: Optional[int] = None,
    month: Optional[str] = None,
    product: Optional[str] = None,
    segment: Optional[str] = None,
    country: Optional[str] = None,
    discount_band: Optional[str] = None
) -> pd.DataFrame:
    df = df_global.copy()
    if df.empty:
        return df
    if year is not None:
        df = df[df['Year'] == year]
    if month is not None and month != "":
        df = df[df['Month Name'] == month]
    if product is not None and product != "":
        df = df[df['Product'] == product]
    if segment is not None and segment != "":
        df = df[df['Segment'] == segment]
    if country is not None and country != "":
        df = df[df['Country'] == country]
    if discount_band is not None and discount_band != "":
        df = df[df['Discount Band'] == discount_band]
    return df

@app.get("/api/filters")
def get_filters():
    if df_global.empty:
        return {"Year": [], "Month Name": [], "Product": [], "Segment": [], "Country": [], "Discount Band": []}
    
    MONTH_ORDER = {
        "January": 1, "February": 2, "March": 3, "April": 4, "May": 5, "June": 6,
        "July": 7, "August": 8, "September": 9, "October": 10, "November": 11, "December": 12
    }
    
    return {
        "Year": sorted(df_global['Year'].dropna().unique().tolist()),
        "Month Name": sorted(df_global['Month Name'].dropna().unique().tolist(), key=lambda x: MONTH_ORDER.get(x, 99)),
        "Product": sorted(df_global['Product'].dropna().unique().tolist()),
        "Segment": sorted(df_global['Segment'].dropna().unique().tolist()),
        "Country": sorted(df_global['Country'].dropna().unique().tolist()),
        "Discount Band": sorted(df_global['Discount Band'].dropna().unique().tolist()),
    }

@app.get("/api/kpis")
def get_kpis(
    year: Optional[int] = None, month: Optional[str] = None, product: Optional[str] = None,
    segment: Optional[str] = None, country: Optional[str] = None, discount_band: Optional[str] = None
):
    filters = {"year": year, "month": month, "product": product, "segment": segment,
               "country": country, "discount_band": discount_band}
    try:
        return powerbi_semantic.get_kpis(filters)
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/sales-trend")
def get_sales_trend(
    year: Optional[int] = None, month: Optional[str] = None, product: Optional[str] = None,
    segment: Optional[str] = None, country: Optional[str] = None, discount_band: Optional[str] = None
):
    filters = {"year": year, "month": month, "product": product, "segment": segment,
               "country": country, "discount_band": discount_band}
    try:
        return powerbi_semantic.get_sales_trend(filters)
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/sales-by-product")
def get_sales_by_product(
    year: Optional[int] = None, month: Optional[str] = None, product: Optional[str] = None,
    segment: Optional[str] = None, country: Optional[str] = None, discount_band: Optional[str] = None
):
    filters = {"year": year, "month": month, "product": product, "segment": segment,
               "country": country, "discount_band": discount_band}
    try:
        return powerbi_semantic.get_sales_by_product(filters)
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/sales-by-country")
def get_sales_by_country(
    year: Optional[int] = None, month: Optional[str] = None, product: Optional[str] = None,
    segment: Optional[str] = None, country: Optional[str] = None, discount_band: Optional[str] = None
):
    filters = {"year": year, "month": month, "product": product, "segment": segment,
               "country": country, "discount_band": discount_band}
    try:
        return powerbi_semantic.get_sales_by_country(filters)
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/sales-by-segment")
def get_sales_by_segment(
    year: Optional[int] = None, month: Optional[str] = None, product: Optional[str] = None,
    segment: Optional[str] = None, country: Optional[str] = None, discount_band: Optional[str] = None
):
    filters = {"year": year, "month": month, "product": product, "segment": segment,
               "country": country, "discount_band": discount_band}
    try:
        return powerbi_semantic.get_sales_by_segment(filters)
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/discount-impact")
def get_discount_impact(
    year: Optional[int] = None, month: Optional[str] = None, product: Optional[str] = None,
    segment: Optional[str] = None, country: Optional[str] = None, discount_band: Optional[str] = None
):
    filters = {"year": year, "month": month, "product": product, "segment": segment,
               "country": country, "discount_band": discount_band}
    try:
        return powerbi_semantic.get_discount_impact(filters)
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/sales-vs-forecast")
def get_sales_vs_forecast(
    year: Optional[int] = None, month: Optional[str] = None, product: Optional[str] = None,
    segment: Optional[str] = None, country: Optional[str] = None, discount_band: Optional[str] = None
):
    filters = {"year": year, "month": month, "product": product, "segment": segment,
               "country": country, "discount_band": discount_band}
    try:
        return powerbi_semantic.get_sales_vs_forecast(filters)
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/records")
def get_records(
    year: Optional[int] = None, month: Optional[str] = None, product: Optional[str] = None,
    segment: Optional[str] = None, country: Optional[str] = None, discount_band: Optional[str] = None,
    page: int = 1, page_size: int = 20
):
    df = get_filtered_df(year, month, product, segment, country, discount_band)
    total = len(df)
    if df.empty:
        return {"data": [], "total": 0, "page": page, "page_size": page_size, "total_pages": 0}
        
    start = (page - 1) * page_size
    end = start + page_size
    page_data = df.iloc[start:end].replace({np.nan: None})
    
    if 'Date' in page_data.columns:
        page_data['Date'] = page_data['Date'].dt.strftime('%Y-%m-%d')

    return {
        "data": page_data.to_dict(orient='records'),
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": math.ceil(total / page_size)
    }


# ---------------------------------------------------------------------------
# Chatbot (Agno tool-calling agent — hits this app's own /api/* endpoints,
# which are themselves backed by the Power BI semantic model, so the chatbot
# and the dashboard always read from the same numbers).
#
# NOTE: this route is intentionally a SYNC "def", not "async def". The
# agent's tools make blocking requests.get() calls back into this same
# FastAPI server (e.g. to /api/kpis). If this route were async and awaited
# the agent inline, the event loop could end up waiting on a request that is
# itself waiting on this same event loop -> deadlock. FastAPI runs sync
# "def" routes in a thread pool automatically, which avoids that.
# ---------------------------------------------------------------------------

class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None


class ChatResponse(BaseModel):
    response: str
    session_id: str


@app.post("/api/chat", response_model=ChatResponse)
def chat(req: ChatRequest):
    message = (req.message or "").strip()
    if not message:
        raise HTTPException(status_code=400, detail="message must not be empty")

    session_id = req.session_id or str(uuid.uuid4())

    try:
        agent = get_dashboard_agent()
    except RuntimeError as e:
        # Missing/invalid Azure OpenAI configuration
        logger.error(f"[CHAT CONFIG ERROR] {e}")
        raise HTTPException(status_code=500, detail=str(e))

    logger.info(f"[CHAT] session={session_id} question={message!r}")
    try:
        run_output = agent.run(message, session_id=session_id)
        answer = run_output.content or ""
        logger.info(f"[CHAT] session={session_id} answer={answer!r}")
        return ChatResponse(response=answer, session_id=session_id)
    except Exception as e:
        logger.exception(f"[CHAT ERROR] session={session_id}")
        raise HTTPException(status_code=502, detail=f"Chatbot agent failed: {e}")