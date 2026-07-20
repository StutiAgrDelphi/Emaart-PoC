import { Request, Response } from 'express';
import { OpenAIClient, AzureKeyCredential } from '@azure/openai';

const systemInstructions = `You write a short executive brief for a financial sales dashboard, in the style of a sell-side analyst note: punchy, specific, numbers-first, no fluff.
You are given pre-computed aggregate figures — they are already correct. Never recompute, round differently, or invent numbers not present in the input.
Write 4 to 6 bullets. Each bullet is ONE sentence, plain language, leading with the finding.
Prioritize, in order of importance: overall direction (up/down/flat vs. what's typical), the single best and single worst performer among products, countries, or segments, any notable forecast beat/miss, and discount bands that are eating into profit.
Bold the 2-4 most important words or figures per bullet with **double asterisks**, the way an analyst would skim-highlight a note.
If a filter (year/month/product/segment/country/discount band) is active, mention that scope naturally in the first bullet — don't just say 'the data'.
Never mention 'the data', 'the dataset', 'JSON', or how the numbers were computed.
Respond with ONLY the bullet lines, one per line, each starting with '- '. No headline, no preamble, no closing summary — just the 4 to 6 bullet lines.`;

export async function handleInsights(req: Request, res: Response) {
    try {
        const payload = req.body;
        
        // Formatters
        const fmtDollar = (num: number) => `$${Math.round(num || 0).toLocaleString('en-US')}`;
        const fmtPct = (num: number) => `${(num || 0).toFixed(1)}%`;
        const fmtSignedPct = (num: number) => `${num > 0 ? '+' : ''}${(num || 0).toFixed(1)}%`;

        // 1. Filters
        const filtersStr = Object.entries(payload.filters || {}).map(([k, v]) => `${k}: ${v}`).join(', ') || 'none (all data)';
        
        // 2. KPIs
        const k = payload.kpis || {};
        const kpisStr = `Totals: Sales ${fmtDollar(k.total_sales)}, Profit ${fmtDollar(k.total_profit)}, Units ${Math.round(k.total_units_sold || 0).toLocaleString('en-US')}, Forecast ${fmtDollar(k.total_forecast)}, Profit margin ${fmtPct(k.profit_margin_pct)}, Avg discount ${fmtPct(k.avg_discount_pct)}`;

        // Breakdowns
        const topBy = (arr: any[], key: string, valKey: string) => arr.map(x => `${x[key]}=${fmtDollar(x[valKey])}`).join(', ');
        const productStr = payload.salesByProduct ? `Sales by product: ${topBy(payload.salesByProduct, 'Product', 'Total Sales')}` : '';
        const countryStr = payload.salesByCountry ? `Sales by country: ${topBy(payload.salesByCountry, 'Country', 'Total Sales')}` : '';
        const segmentStr = payload.salesBySegment ? `Sales by segment: ${topBy(payload.salesBySegment, 'Segment', 'Total Sales')}` : '';
        
        const discountStr = payload.discountImpact ? `Profit by discount band: ${payload.discountImpact.map((x: any) => `${x['Discount Band']}=profit ${fmtDollar(x.Profit)} avg_discount ${fmtDollar(x.Avg_Discount)}`).join(', ')}` : '';

        // Sales vs Forecast
        let forecastStr = '';
        if (payload.salesVsForecast && payload.salesVsForecast.length > 0) {
            let totalS = 0;
            let totalF = 0;
            let weakestMonth = '';
            let weakestDiff = Infinity;

            for (const m of payload.salesVsForecast) {
                totalS += (m.Sales || 0);
                totalF += (m.Forecast || 0);
                const diff = (m.Sales || 0) - (m.Forecast || 0);
                if (diff < weakestDiff) {
                    weakestDiff = diff;
                    weakestMonth = m['Month Name'];
                }
            }
            const varPct = totalF !== 0 ? ((totalS - totalF) / totalF) * 100 : 0;
            forecastStr = `Sales vs forecast: period totals variance ${fmtSignedPct(varPct)}, weakest month (lowest Sales-minus-Forecast) is ${weakestMonth} (${fmtDollar(weakestDiff)})`;
        }

        const summaryText = [
            `Active filters: ${filtersStr}`,
            kpisStr,
            productStr,
            countryStr,
            segmentStr,
            discountStr,
            forecastStr
        ].filter(x => !!x).join('\n');

        const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
        const apiKey = process.env.AZURE_OPENAI_API_KEY;
        const deployment = process.env.AZURE_OPENAI_DEPLOYMENT;
        const apiVersion = process.env.AZURE_OPENAI_API_VERSION || "2024-10-21";

        if (!endpoint || !apiKey || !deployment) {
            throw new Error("Missing Azure OpenAI configuration.");
        }
        
        const client = new OpenAIClient(endpoint, new AzureKeyCredential(apiKey), { apiVersion });

        const messages = [
            { role: "system", content: systemInstructions },
            { role: "user", content: summaryText }
        ];

        const response = await client.getChatCompletions(deployment, messages as any);
        const text = response.choices[0]?.message?.content || "";

        // Parse into a bullet array (strip leading -, •, *, whitespace; skip blanks)
        const bullets = text.split('\n')
            .map((line: string) => line.replace(/^[\-\•\*\s]+/, '').trim())
            .filter((line: string) => line.length > 0);

        res.json({
            bullets,
            generated_at: new Date().toISOString()
        });
    } catch (error: any) {
        console.error("Insights error:", error);
        res.status(500).json({ error: error.message });
    }
}
