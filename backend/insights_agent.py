import logging
from datetime import datetime, timezone
from typing import Optional

from agno.agent import Agent

from azure_model import build_azure_model

logger = logging.getLogger("dashboard.insights")

INSIGHTS_INSTRUCTIONS = [
    "You write a short executive brief for a financial sales dashboard, in the style of a "
    "sell-side analyst note: punchy, specific, numbers-first, no fluff.",
    "You are given pre-computed aggregate figures — they are already correct. Never recompute, "
    "round differently, or invent numbers not present in the input.",
    "Write 4 to 6 bullets. Each bullet is ONE sentence, plain language, leading with the finding.",
    "Prioritize, in order of importance: overall direction (up/down/flat vs. what's typical), the single "
    "best and single worst performer among products, countries, or segments, any notable forecast "
    "beat/miss, and discount bands that are eating into profit.",
    "Bold the 2-4 most important words or figures per bullet with **double asterisks**, the way an "
    "analyst would skim-highlight a note.",
    "If a filter (year/month/product/segment/country/discount band) is active, mention that scope "
    "naturally in the first bullet — don't just say 'the data'.",
    "Never mention 'the data', 'the dataset', 'JSON', or how the numbers were computed.",
    "Respond with ONLY the bullet lines, one per line, each starting with '- '. No headline, no "
    "preamble, no closing summary — just the 4 to 6 bullet lines.",
]

_agent_instance: "Agent | None" = None


def get_insights_agent() -> Agent:
    global _agent_instance
    if _agent_instance is None:
        _agent_instance = Agent(
            name="Insights Agent",
            model=build_azure_model(),
            instructions=INSIGHTS_INSTRUCTIONS,
            markdown=False,
        )
    return _agent_instance


def _fmt_money(v) -> str:
    try:
        return f"${v:,.0f}"
    except (TypeError, ValueError):
        return str(v)


def _parse_bullets(text: str) -> list[str]:
    bullets = []
    for line in (text or "").splitlines():
        line = line.strip().lstrip("-•*").strip()
        if line:
            bullets.append(line)
    return bullets


def build_summary_prompt(
    filters: dict, kpis: dict, by_product: list, by_country: list,
    by_segment: list, discount_impact: list, vs_forecast: list,
) -> str:
    """Turn already-fetched aggregate numbers (same ones the dashboard cards
    show) into a compact text block for the LLM. No raw rows, no recompute."""
    active_filters = {k: v for k, v in filters.items() if v}
    lines = [f"Active filters: {active_filters if active_filters else 'none (all data)'}"]

    lines.append(
        f"Totals — Sales: {_fmt_money(kpis.get('total_sales'))}, "
        f"Profit: {_fmt_money(kpis.get('total_profit'))}, "
        f"Units: {kpis.get('total_units_sold')}, "
        f"Forecast: {_fmt_money(kpis.get('total_forecast'))}, "
        f"Profit margin: {kpis.get('profit_margin_pct', 0):.1f}%, "
        f"Avg discount: {kpis.get('avg_discount_pct', 0):.1f}%"
    )

    if by_product:
        ranked = sorted(by_product, key=lambda r: r.get('Sales', 0), reverse=True)
        lines.append("Sales by product: " + ", ".join(f"{r['Product']}={_fmt_money(r.get('Sales'))}" for r in ranked))

    if by_country:
        ranked = sorted(by_country, key=lambda r: r.get('Sales', 0), reverse=True)
        lines.append("Sales by country: " + ", ".join(f"{r['Country']}={_fmt_money(r.get('Sales'))}" for r in ranked))

    if by_segment:
        ranked = sorted(by_segment, key=lambda r: r.get('Sales', 0), reverse=True)
        lines.append("Sales by segment: " + ", ".join(f"{r['Segment']}={_fmt_money(r.get('Sales'))}" for r in ranked))

    if discount_impact:
        lines.append("Profit by discount band: " + ", ".join(
            f"{r.get('Discount Band')}=profit {_fmt_money(r.get('Profit'))} "
            f"avg_discount {_fmt_money(r.get('Avg_Discount'))}"
            for r in discount_impact
        ))

    if vs_forecast:
        total_sales = sum(r.get('Sales', 0) for r in vs_forecast)
        total_fc = sum(r.get('Forecast', 0) for r in vs_forecast)
        variance_pct = ((total_sales - total_fc) / total_fc * 100) if total_fc else 0
        lines.append(
            f"Sales vs forecast (period total): actual {_fmt_money(total_sales)} vs "
            f"forecast {_fmt_money(total_fc)} ({variance_pct:+.1f}%)"
        )
        worst_month = min(vs_forecast, key=lambda r: r.get('Sales', 0) - r.get('Forecast', 0), default=None)
        if worst_month:
            lines.append(
                f"Weakest month vs forecast: {worst_month.get('Month Name')} "
                f"({_fmt_money(worst_month.get('Sales'))} actual vs {_fmt_money(worst_month.get('Forecast'))} forecast)"
            )

    return "\n".join(lines)


def generate_insights(
    filters: dict, kpis: dict, by_product: list, by_country: list,
    by_segment: list, discount_impact: list, vs_forecast: list,
) -> dict:
    summary = build_summary_prompt(filters, kpis, by_product, by_country, by_segment, discount_impact, vs_forecast)
    logger.info(f"[INSIGHTS] prompt summary={summary!r}")

    agent = get_insights_agent()
    run_output = agent.run(summary)
    bullets = _parse_bullets(run_output.content or "")
    logger.info(f"[INSIGHTS] bullets={bullets}")

    return {
        "bullets": bullets,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }