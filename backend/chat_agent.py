import os
import requests
import logging
from functools import wraps
from dotenv import load_dotenv
from agno.agent import Agent
from agno.models.azure import AzureOpenAI
from agno.db.sqlite import SqliteDb

load_dotenv()

BASE_URL = "http://localhost:8000/api"

logger = logging.getLogger("dashboard.chatbot")


def clean_params(kwargs):
    return {k: v for k, v in kwargs.items() if v is not None and v != ""}


def log_tool_call(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
        params = clean_params(kwargs) if kwargs else {}
        logger.info(f"[TOOL CALL] {func.__name__} params={params}")
        result = func(*args, **kwargs)
        summary = result if not isinstance(result, (list, dict)) else (
            f"{len(result)} items" if isinstance(result, list) else f"keys={list(result.keys())}"
        )
        logger.info(f"[TOOL RESULT] {func.__name__} -> {summary}")
        return result
    return wrapper


@log_tool_call
def get_filters_tool():
    """Gets the available filter distinct values (Years, Months, Products, Segments, Countries, Discount Bands)."""
    response = requests.get(f"{BASE_URL}/filters", timeout=10)
    response.raise_for_status()
    return response.json()


@log_tool_call
def get_kpis_tool(year: int = None, month: str = None, product: str = None, segment: str = None, country: str = None, discount_band: str = None):
    """Gets total sales, total profit, units sold, avg discount pct, profit margin pct, and total forecast. Pass only needed filters."""
    response = requests.get(f"{BASE_URL}/kpis", params=clean_params(locals()), timeout=10)
    response.raise_for_status()
    return response.json()


@log_tool_call
def get_sales_trend_tool(year: int = None, month: str = None, product: str = None, segment: str = None, country: str = None, discount_band: str = None):
    """Gets sales and profit trend grouped chronologically by Year+Month. Pass only needed filters."""
    response = requests.get(f"{BASE_URL}/sales-trend", params=clean_params(locals()), timeout=10)
    response.raise_for_status()
    return response.json()


@log_tool_call
def get_sales_by_product_tool(year: int = None, month: str = None, product: str = None, segment: str = None, country: str = None, discount_band: str = None):
    """Gets total sales and profit grouped by Product. Pass only needed filters."""
    response = requests.get(f"{BASE_URL}/sales-by-product", params=clean_params(locals()), timeout=10)
    response.raise_for_status()
    return response.json()


@log_tool_call
def get_sales_by_country_tool(year: int = None, month: str = None, product: str = None, segment: str = None, country: str = None, discount_band: str = None):
    """Gets total sales grouped by Country. Pass only needed filters."""
    response = requests.get(f"{BASE_URL}/sales-by-country", params=clean_params(locals()), timeout=10)
    response.raise_for_status()
    return response.json()


@log_tool_call
def get_sales_by_segment_tool(year: int = None, month: str = None, product: str = None, segment: str = None, country: str = None, discount_band: str = None):
    """Gets total sales grouped by Segment. Pass only needed filters."""
    response = requests.get(f"{BASE_URL}/sales-by-segment", params=clean_params(locals()), timeout=10)
    response.raise_for_status()
    return response.json()


@log_tool_call
def get_discount_impact_tool(year: int = None, month: str = None, product: str = None, segment: str = None, country: str = None, discount_band: str = None):
    """Gets profit and average discount grouped by Discount Band. Pass only needed filters."""
    response = requests.get(f"{BASE_URL}/discount-impact", params=clean_params(locals()), timeout=10)
    response.raise_for_status()
    return response.json()


@log_tool_call
def get_sales_vs_forecast_tool(year: int = None, month: str = None, product: str = None, segment: str = None, country: str = None, discount_band: str = None):
    """Gets actual Sales vs Forecast, grouped by Month. Pass only needed filters."""
    response = requests.get(f"{BASE_URL}/sales-vs-forecast", params=clean_params(locals()), timeout=10)
    response.raise_for_status()
    return response.json()


@log_tool_call
def get_records_tool(year: int = None, month: str = None, product: str = None, segment: str = None, country: str = None, discount_band: str = None, page: int = 1, page_size: int = 20):
    """Gets raw dataset records. Pass only needed filters. Returns paginated data."""
    response = requests.get(f"{BASE_URL}/records", params=clean_params(locals()), timeout=10)
    response.raise_for_status()
    return response.json()


AGENT_INSTRUCTIONS = [
    "You are a data analyst assistant for a financial sales dashboard covering 2013-2014.",
    "Known dimension values (use these exact strings when calling tools, do not guess or invent variants):",
    "Years: 2013, 2014",
    "Months: January, February, March, April, May, June, July, August, September, October, November, December",
    "Products: Carretera, Montana, Paseo, Velo, VTT, Amarilla",
    "Segments: Government, Midmarket, Channel Partners, Enterprise, Small Business",
    "Countries: Canada, Germany, France, Mexico, United States of America",
    "Discount Bands: None, Low, Medium, High",
    "Map casual user phrasing to these exact values (e.g. 'US' or 'USA' -> 'United States of America').",
    "Always call the relevant tool(s) to get real numbers before answering — never estimate or make up figures.",
    "Format currency values clearly (e.g. $1,234,567) and percentages with 2 decimal places.",
    "Keep answers concise and conversational, a few sentences, not a report.",
    "If a question needs comparison across multiple filters (e.g. 'compare Germany vs France'), call the relevant tool once per filter value and compare the results yourself.",
]


def _build_model() -> AzureOpenAI:
    """Build the Azure OpenAI model client, using the SAME env var names as
    chat_agent.py (the previously working agent) — NOT '_NAME' suffixed
    variants — since that's what's actually set in backend/.env."""
    deployment = os.getenv("AZURE_OPENAI_DEPLOYMENT")
    api_key = os.getenv("AZURE_OPENAI_API_KEY")
    azure_endpoint = os.getenv("AZURE_OPENAI_ENDPOINT")
    api_version = os.getenv("AZURE_OPENAI_API_VERSION", "2024-10-21")

    missing = [
        name
        for name, val in [
            ("AZURE_OPENAI_DEPLOYMENT", deployment),
            ("AZURE_OPENAI_API_KEY", api_key),
            ("AZURE_OPENAI_ENDPOINT", azure_endpoint),
        ]
        if not val
    ]
    if missing:
        raise RuntimeError(
            "Missing required Azure OpenAI environment variable(s): " + ", ".join(missing)
        )

    return AzureOpenAI(
        id=deployment,
        azure_deployment=deployment,
        api_key=api_key,
        azure_endpoint=azure_endpoint,
        api_version=api_version,
    )


_db = SqliteDb(db_file=os.path.join(os.path.dirname(__file__), "agent_memory.db"))

_agent_instance: "Agent | None" = None


def get_dashboard_agent() -> Agent:
    global _agent_instance
    if _agent_instance is None:
        _agent_instance = Agent(
            name="Dashboard Assistant",
            model=_build_model(),
            tools=[
                get_filters_tool, get_kpis_tool, get_sales_trend_tool,
                get_sales_by_product_tool, get_sales_by_country_tool,
                get_sales_by_segment_tool, get_discount_impact_tool,
                get_sales_vs_forecast_tool, get_records_tool,
            ],
            db=_db,
            add_history_to_context=True,
            num_history_runs=6,
            instructions=AGENT_INSTRUCTIONS,
            markdown=False,
        )
    return _agent_instance