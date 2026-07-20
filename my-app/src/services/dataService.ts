import { getFabricClient } from "@/lib/fabric-client";
import { fabricConfig } from "@/fabric.generated";

// Helper to get the generated semantic model alias automatically
const modelAlias = Object.keys((fabricConfig as any).semanticModels)[0];

export interface DashboardFilters {
    year?: string | number;
    month?: string;
    product?: string;
    segment?: string;
    country?: string;
    discount_band?: string;
}

function buildFilterString(args: DashboardFilters): string {
    const filters = [];
    if (args.year) filters.push(`TREATAS({${args.year}}, FinancialData[Year])`);
    if (args.month) filters.push(`TREATAS({"${args.month}"}, FinancialData[Month Name])`);
    if (args.product) filters.push(`TREATAS({"${args.product}"}, FinancialData[Product])`);
    if (args.segment) filters.push(`TREATAS({"${args.segment}"}, FinancialData[Segment])`);
    if (args.country) filters.push(`TREATAS({"${args.country}"}, FinancialData[Country])`);
    if (args.discount_band) filters.push(`TREATAS({"${args.discount_band}"}, FinancialData[Discount Band])`);
    return filters.join(", ");
}

/**
 * Executes a DAX query against the FabricClient and maps the row-major 
 * result (unknown[][]) to an array of keyed objects.
 */
export async function executeDaxQuery(query: string): Promise<any[]> {
    const client = getFabricClient();
    const result = await client.semanticModel(modelAlias).query(query);
    
    if (result.status !== "success" || !result.table) {
        console.error("DAX Query Failed", result);
        throw new Error(`DAX Query Failed: ${JSON.stringify((result as any).error ?? result)}`);
    }

    const { columns, rows } = result.table;
    const cleanColumns = columns.map((c: any) => c.name.replace(/^.*?\[/, '').replace(/\]$/, ''));

    return rows.map((rowArray: any) => {
        const rowObj: any = {};
        cleanColumns.forEach((colName: any, i: number) => {
            rowObj[colName] = rowArray[i] === null ? 0 : rowArray[i];
        });
        return rowObj;
    });
}

// --------------------------------------------------------
// Dashboard Metric Fetchers
// --------------------------------------------------------

export async function fetchKPIs(args: DashboardFilters = {}) {
    const filters = buildFilterString(args);
    const dax = `EVALUATE SUMMARIZECOLUMNS(${filters ? filters + ", " : ""}"Total Sales", [Total Sales], "Total Profit", [Total Profit], "Total Units Sold", [Total Units Sold], "Total Forecast", [Total Forecast], "Profit Margin %", [Profit Margin %], "Avg Discount %", [Avg Discount %])`;
    const res = await executeDaxQuery(dax);
    if (res.length > 0) {
        const r = res[0];
        return {
            total_sales: r["Total Sales"],
            total_profit: r["Total Profit"],
            total_units_sold: r["Total Units Sold"],
            total_forecast: r["Total Forecast"],
            profit_margin_pct: (r["Profit Margin %"] || 0) * 100,
            avg_discount_pct: (r["Avg Discount %"] || 0) * 100
        };
    }
    return null;
}

export async function fetchSalesTrend(args: DashboardFilters = {}) {
    const filters = buildFilterString(args);
    const filterClause = filters ? `, ${filters}` : "";
    const dax = `EVALUATE SUMMARIZECOLUMNS(FinancialData[Year], FinancialData[Month Number], FinancialData[Month Name]${filterClause}, "Total Sales", [Total Sales], "Total Profit", [Total Profit]) ORDER BY FinancialData[Year], FinancialData[Month Number]`;
    const res = await executeDaxQuery(dax);
    return res.map(r => ({
        Period: `${r.Year} - ${r["Month Name"]}`,
        Sales: r["Total Sales"],
        Profit: r["Total Profit"]
    }));
}

export async function fetchSalesByProduct(args: DashboardFilters = {}) {
    const filters = buildFilterString(args);
    const filterClause = filters ? `, ${filters}` : "";
    const dax = `EVALUATE SUMMARIZECOLUMNS(FinancialData[Product]${filterClause}, "Total Sales", [Total Sales], "Total Profit", [Total Profit]) ORDER BY [Total Sales] DESC`;
    return await executeDaxQuery(dax);
}

export async function fetchSalesByCountry(args: DashboardFilters = {}) {
    const filters = buildFilterString(args);
    const filterClause = filters ? `, ${filters}` : "";
    const dax = `EVALUATE SUMMARIZECOLUMNS(FinancialData[Country]${filterClause}, "Total Sales", [Total Sales]) ORDER BY [Total Sales] DESC`;
    return await executeDaxQuery(dax);
}

export async function fetchSalesBySegment(args: DashboardFilters = {}) {
    const filters = buildFilterString(args);
    const filterClause = filters ? `, ${filters}` : "";
    const dax = `EVALUATE SUMMARIZECOLUMNS(FinancialData[Segment]${filterClause}, "Total Sales", [Total Sales]) ORDER BY [Total Sales] DESC`;
    return await executeDaxQuery(dax);
}

export async function fetchDiscountImpact(args: DashboardFilters = {}) {
    const filters = buildFilterString(args);
    const filterClause = filters ? `, ${filters}` : "";
    const dax = `EVALUATE SUMMARIZECOLUMNS(FinancialData[Discount Band]${filterClause}, "Profit", [Total Profit], "Avg_Discount", AVERAGE(FinancialData[Discounts]))`;
    return await executeDaxQuery(dax);
}

export async function fetchSalesVsForecast(args: DashboardFilters = {}) {
    const filters = buildFilterString(args);
    const filterClause = filters ? `, ${filters}` : "";
    const dax = `EVALUATE SUMMARIZECOLUMNS(FinancialData[Month Number], FinancialData[Month Name]${filterClause}, "Sales", [Total Sales], "Forecast", [Total Forecast]) ORDER BY FinancialData[Month Number]`;
    const res = await executeDaxQuery(dax);
    return res.map(r => ({
        "Month Name": r["Month Name"],
        Sales: r.Sales,
        Forecast: r.Forecast
    }));
}

export async function fetchRecords(args: DashboardFilters & { page?: number, page_size?: number } = {}) {
    const filters = buildFilterString(args);
    const filterClause = filters ? `, ${filters}` : "";
    const dax = `EVALUATE CALCULATETABLE(FinancialData${filterClause})`;
    console.log("FETCH_RECORDS_DAX:", dax);
    const res = await executeDaxQuery(dax);
    console.log("FETCH_RECORDS_RES_LENGTH:", res.length);
    if (res.length > 0) {
        console.log("FETCH_RECORDS_KEYS_RAW:", JSON.stringify(Object.keys(res[0])));
        console.log("FETCH_RECORDS_ROW_RAW:", JSON.stringify(res[0]));
    }
    // Format dates (YYYY-MM-DD)
    res.forEach(r => {
        if (r.Date) {
            r.Date = new Date(r.Date).toISOString().split('T')[0];
        }
    });
    const page = args.page || 1;
    const pageSize = args.page_size || 20;
    const start = (page - 1) * pageSize;
    return {
        data: res.slice(start, start + pageSize),
        total: res.length
    };
}

export async function fetchFilterValues() {
    const years = await executeDaxQuery(`EVALUATE SUMMARIZECOLUMNS(FinancialData[Year])`);
    const months = await executeDaxQuery(`EVALUATE SUMMARIZECOLUMNS(FinancialData[Month Number], FinancialData[Month Name]) ORDER BY FinancialData[Month Number]`);
    const products = await executeDaxQuery(`EVALUATE SUMMARIZECOLUMNS(FinancialData[Product])`);
    const segments = await executeDaxQuery(`EVALUATE SUMMARIZECOLUMNS(FinancialData[Segment])`);
    const countries = await executeDaxQuery(`EVALUATE SUMMARIZECOLUMNS(FinancialData[Country])`);
    const discounts = await executeDaxQuery(`EVALUATE SUMMARIZECOLUMNS(FinancialData[Discount Band])`);
    
    return {
        years: years.map(r => r.Year),
        months: months.map(r => r["Month Name"]),
        products: products.map(r => r.Product),
        segments: segments.map(r => r.Segment),
        countries: countries.map(r => r.Country),
        discount_bands: discounts.map(r => r["Discount Band"])
    };
}

// --------------------------------------------------------
// LLM API Calls (Insights & Chat)
// --------------------------------------------------------


export async function fetchInsights(payload: any) {
    const apiUrl = import.meta.env.VITE_CHAT_FUNCTION_URL;
    if (!apiUrl) throw new Error("VITE_CHAT_FUNCTION_URL not set");

    const response = await fetch(`${apiUrl}/insights`, {
        method: 'POST',
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || `Insights request failed (${response.status})`);
    return data;
}
 

export async function sendChatMessage(payload: any) {
    const apiUrl = import.meta.env.VITE_CHAT_FUNCTION_URL;
    if (!apiUrl) throw new Error("VITE_CHAT_FUNCTION_URL not set");

    const response = await fetch(`${apiUrl}/chat`, {
        method: 'POST',
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || `Chat request failed (${response.status})`);
    return data;
}
 