"""
Client for the Power BI semantic model layer.

Architecture:
    CSV (data layer)
      -> Power BI Desktop / Service semantic model
         - Table: FinancialData  (the raw rows)
         - Table: Measure        (container for the DAX measures — named
           "Measure" not "Measures" because "Measures" is a reserved name
           in Power BI Desktop)
      -> THIS MODULE builds a DAX query and calls Power BI's "Execute
         Queries" REST API to run it against the published semantic model
      -> main.py exposes the result as JSON, unchanged from the wire shape
         the React app already expects
      -> React renders it, exactly as before

Important: FastAPI does NOT recompute sums, averages, or percentages here.
Every aggregation (SUM, AVERAGE, DIVIDE, ratios) is expressed as a DAX
measure inside the semantic model and requested by name (e.g. [Total Sales],
[Profit Margin %]). The only work this module does after getting a result
back is (a) pick which measures/columns to ask for, (b) apply filters the
user picked, and (c) light reshaping (e.g. ratio -> percentage number) to
match the existing API contract the frontend already expects. That's the
"FastAPI is just the transport" part.

Auth model: app-only (service principal) auth via MSAL's client-credentials
flow — see the setup checklist in backend/.env.example (Part 2, currently
paused). Until POWERBI_* env vars are filled in, every function below raises
a clear RuntimeError rather than a stack trace.
"""

import os
from typing import Any, Optional

import msal
import requests

POWERBI_RESOURCE_SCOPE = "https://analysis.windows.net/powerbi/api/.default"
POWERBI_API_BASE = "https://api.powerbi.com/v1.0/myorg"

TABLE = "FinancialData"

# Maps the query params the frontend already sends -> the semantic model's
# column names (adjust the right-hand side if your column names differ).
FILTER_COLUMN_MAP = {
    "year": "Year",
    "month": "Month Name",
    "product": "Product",
    "segment": "Segment",
    "country": "Country",
    "discount_band": "Discount Band",
}


# ---------------------------------------------------------------------------
# Auth + low-level query execution
# ---------------------------------------------------------------------------

def _get_access_token() -> str:
    """Acquire an app-only access token via client-credentials flow."""
    tenant_id = os.getenv("POWERBI_TENANT_ID")
    client_id = os.getenv("POWERBI_CLIENT_ID")
    client_secret = os.getenv("POWERBI_CLIENT_SECRET")

    missing = [
        name
        for name, val in [
            ("POWERBI_TENANT_ID", tenant_id),
            ("POWERBI_CLIENT_ID", client_id),
            ("POWERBI_CLIENT_SECRET", client_secret),
        ]
        if not val
    ]
    if missing:
        raise RuntimeError(
            "Missing required Power BI environment variable(s): " + ", ".join(missing)
            + " (Part 2 setup — see backend/.env.example)."
        )

    app = msal.ConfidentialClientApplication(
        client_id=client_id,
        client_credential=client_secret,
        authority=f"https://login.microsoftonline.com/{tenant_id}",
    )
    result = app.acquire_token_for_client(scopes=[POWERBI_RESOURCE_SCOPE])

    if "access_token" not in result:
        raise RuntimeError(
            "Failed to authenticate with Azure AD: "
            f"{result.get('error')}: {result.get('error_description')}"
        )
    return result["access_token"]


def run_dax_query(dax_query: str) -> list[dict]:
    """Execute a DAX query and return the first result table as row-dicts."""
    workspace_id = os.getenv("POWERBI_WORKSPACE_ID")
    dataset_id = os.getenv("POWERBI_DATASET_ID")
    if not workspace_id or not dataset_id:
        raise RuntimeError(
            "Missing POWERBI_WORKSPACE_ID or POWERBI_DATASET_ID environment "
            "variable(s) (Part 2 setup — see backend/.env.example)."
        )

    token = _get_access_token()
    url = f"{POWERBI_API_BASE}/groups/{workspace_id}/datasets/{dataset_id}/executeQueries"

    resp = requests.post(
        url,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        json={"queries": [{"query": dax_query}], "serializerSettings": {"includeNulls": True}},
        timeout=30,
    )
    if resp.status_code != 200:
        raise RuntimeError(f"Power BI API error ({resp.status_code}): {resp.text}")

    tables = resp.json()["results"][0]["tables"]
    return tables[0]["rows"] if tables else []


# ---------------------------------------------------------------------------
# DAX query builder
# ---------------------------------------------------------------------------

def _dax_literal(value: Any) -> str:
    if isinstance(value, (int, float)):
        return str(value)
    escaped = str(value).replace('"', '""')
    return f'"{escaped}"'


def _build_filter_clauses(filters: dict) -> list[str]:
    clauses = []
    for key, column in FILTER_COLUMN_MAP.items():
        value = filters.get(key)
        if value is None or value == "":
            continue
        clauses.append(f"TREATAS({{{_dax_literal(value)}}}, {TABLE}[{column}])")
    return clauses


def _summarize(
    group_by: list[str],
    value_exprs: dict[str, str],
    filters: dict,
    order_by: Optional[str] = None,
) -> str:
    """Build an `EVALUATE SUMMARIZECOLUMNS(...)` DAX query."""
    args = [f"{TABLE}[{col}]" for col in group_by]
    args += _build_filter_clauses(filters)
    args += [f'"{alias}", {expr}' for alias, expr in value_exprs.items()]
    body = ",\n    ".join(args)
    dax = f"EVALUATE\nSUMMARIZECOLUMNS(\n    {body}\n)"
    if order_by:
        dax += f"\nORDER BY {order_by}"
    return dax


def _clean_row(row: dict) -> dict:
    """Power BI returns keys like 'FinancialData[Year]' -> tidy to 'Year'; None -> 0."""
    clean = {}
    for k, v in row.items():
        name = k.split("[")[-1].rstrip("]")
        clean[name] = v if v is not None else 0
    return clean


# ---------------------------------------------------------------------------
# Public functions — one per dashboard endpoint, same filter signature
# ---------------------------------------------------------------------------

def get_kpis(filters: dict) -> dict:
    dax = _summarize(
        group_by=[],
        value_exprs={
            "Total Sales": "[Total Sales]",
            "Total Profit": "[Total Profit]",
            "Total Units Sold": "[Total Units Sold]",
            "Total Forecast": "[Total Forecast]",
            "Profit Margin %": "[Profit Margin %]",
            "Avg Discount %": "[Avg Discount %]",
        },
        filters=filters,
    )
    rows = run_dax_query(dax)
    if not rows:
        return {
            "total_sales": 0, "total_profit": 0, "total_units_sold": 0,
            "avg_discount_pct": 0, "profit_margin_pct": 0, "total_forecast": 0,
        }
    row = _clean_row(rows[0])
    return {
        "total_sales": row["Total Sales"],
        "total_profit": row["Total Profit"],
        "total_units_sold": row["Total Units Sold"],
        "total_forecast": row["Total Forecast"],
        # These are already ratios computed by DAX measures (DIVIDE(...)) —
        # multiplying by 100 here is a unit conversion for the API contract,
        # not a recomputation of the business logic.
        "profit_margin_pct": row["Profit Margin %"] * 100,
        "avg_discount_pct": row["Avg Discount %"] * 100,
    }


def get_sales_trend(filters: dict) -> list[dict]:
    dax = _summarize(
        group_by=["Year", "Month Number", "Month Name"],
        value_exprs={"Sales": "[Total Sales]", "Profit": "[Total Profit]"},
        filters=filters,
        order_by=f"{TABLE}[Year], {TABLE}[Month Number]",
    )
    rows = [_clean_row(r) for r in run_dax_query(dax)]
    return [
        {"Period": f"{r['Year']} - {r['Month Name']}", "Sales": r["Sales"], "Profit": r["Profit"]}
        for r in rows
    ]


def get_sales_by_product(filters: dict) -> list[dict]:
    dax = _summarize(
        group_by=["Product"],
        value_exprs={"Sales": "[Total Sales]", "Profit": "[Total Profit]"},
        filters=filters,
        order_by="[Sales] DESC",
    )
    return [_clean_row(r) for r in run_dax_query(dax)]


def get_sales_by_country(filters: dict) -> list[dict]:
    dax = _summarize(
        group_by=["Country"],
        value_exprs={"Sales": "[Total Sales]"},
        filters=filters,
        order_by="[Sales] DESC",
    )
    return [_clean_row(r) for r in run_dax_query(dax)]


def get_sales_by_segment(filters: dict) -> list[dict]:
    dax = _summarize(
        group_by=["Segment"],
        value_exprs={"Sales": "[Total Sales]"},
        filters=filters,
        order_by="[Sales] DESC",
    )
    return [_clean_row(r) for r in run_dax_query(dax)]


def get_discount_impact(filters: dict) -> list[dict]:
    dax = _summarize(
        group_by=["Discount Band"],
        value_exprs={
            "Profit": "[Total Profit]",
            # No stored measure for this one yet — inline aggregation works
            # in SUMMARIZECOLUMNS too, though you could promote it to a
            # named measure later (Avg Discounts = AVERAGE(FinancialData[Discounts])).
            "Avg_Discount": f"AVERAGE({TABLE}[Discounts])",
        },
        filters=filters,
    )
    return [_clean_row(r) for r in run_dax_query(dax)]


def get_sales_vs_forecast(filters: dict) -> list[dict]:
    dax = _summarize(
        group_by=["Month Number", "Month Name"],
        value_exprs={"Sales": "[Total Sales]", "Forecast": "[Total Forecast]"},
        filters=filters,
        order_by=f"{TABLE}[Month Number]",
    )
    rows = [_clean_row(r) for r in run_dax_query(dax)]
    return [{"Month Name": r["Month Name"], "Sales": r["Sales"], "Forecast": r["Forecast"]} for r in rows]