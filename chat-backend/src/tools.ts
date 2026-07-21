import { executeDaxQuery } from "./powerbi";

const filterParams = {
    year: { type: "string" },
    month: { type: "string" },
    product: { type: "string" },
    segment: { type: "string" },
    country: { type: "string" },
    discount_band: { type: "string" }
};

export const toolSchemas: any[] = [
    {
        type: "function",
        function: {
            name: "get_filters_tool",
            description: "Gets the available filter distinct values (Years, Months, Products, Segments, Countries, Discount Bands).",
            parameters: { type: "object", properties: {}, required: [] }
        }
    },
    {
        type: "function",
        function: {
            name: "get_kpis_tool",
            description: "Gets total sales, total profit, units sold, avg discount pct, profit margin pct, and total forecast. Pass only needed filters.",
            parameters: { type: "object", properties: filterParams }
        }
    },
    {
        type: "function",
        function: {
            name: "get_sales_trend_tool",
            description: "Gets sales and profit trend grouped chronologically by Year+Month. Pass only needed filters.",
            parameters: { type: "object", properties: filterParams }
        }
    },
    {
        type: "function",
        function: {
            name: "get_sales_by_product_tool",
            description: "Gets total sales and profit grouped by Product. Pass only needed filters.",
            parameters: { type: "object", properties: filterParams }
        }
    },
    {
        type: "function",
        function: {
            name: "get_sales_by_country_tool",
            description: "Gets total sales grouped by Country. Pass only needed filters.",
            parameters: { type: "object", properties: filterParams }
        }
    },
    {
        type: "function",
        function: {
            name: "get_sales_by_segment_tool",
            description: "Gets total sales grouped by Segment. Pass only needed filters.",
            parameters: { type: "object", properties: filterParams }
        }
    },
    {
        type: "function",
        function: {
            name: "get_discount_impact_tool",
            description: "Gets profit and average discount grouped by Discount Band. Pass only needed filters.",
            parameters: { type: "object", properties: filterParams }
        }
    },
    {
        type: "function",
        function: {
            name: "get_sales_vs_forecast_tool",
            description: "Gets actual Sales vs Forecast, grouped by Month. Pass only needed filters.",
            parameters: { type: "object", properties: filterParams }
        }
    },
    {
        type: "function",
        function: {
            name: "get_records_tool",
            description: "Gets raw dataset records. Pass only needed filters. Returns paginated data.",
            parameters: {
                type: "object",
                properties: {
                    ...filterParams,
                    page: { type: "number" },
                    page_size: { type: "number" }
                }
            }
        }
    }
];

function buildFilterString(args: any, userCountry?: string | null): string {
    const filters = [];
    if (args.year) filters.push(`TREATAS({${args.year}}, FinancialData[Year])`);
    if (args.month) filters.push(`TREATAS({"${args.month}"}, FinancialData[Month Name])`);
    if (args.product) filters.push(`TREATAS({"${args.product}"}, FinancialData[Product])`);
    if (args.segment) filters.push(`TREATAS({"${args.segment}"}, FinancialData[Segment])`);
    if (userCountry) filters.push(`TREATAS({"${userCountry}"}, FinancialData[Country])`);
    if (args.discount_band) filters.push(`TREATAS({"${args.discount_band}"}, FinancialData[Discount Band])`);
    return filters.join(", ");
}

export async function executeTool(name: string, args: any, userCountry?: string | null): Promise<any> {
    if (process.env.DEBUG) {
        console.log("Tool called:", name, "Args:", args);
    }

    const filters = buildFilterString(args, userCountry);
    const filterClause = filters ? `, ${filters}` : "";

    switch (name) {
        case "get_filters_tool": {
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
        case "get_kpis_tool": {
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
            return {};
        }
        case "get_sales_trend_tool": {
            const dax = `EVALUATE SUMMARIZECOLUMNS(FinancialData[Year], FinancialData[Month Number], FinancialData[Month Name]${filterClause}, "Total Sales", [Total Sales], "Total Profit", [Total Profit]) ORDER BY FinancialData[Year], FinancialData[Month Number]`;
            const res = await executeDaxQuery(dax);
            return res.map(r => ({
                Period: `${r.Year} - ${r["Month Name"]}`,
                Sales: r["Total Sales"],
                Profit: r["Total Profit"]
            }));
        }
        case "get_sales_by_product_tool": {
            const dax = `EVALUATE SUMMARIZECOLUMNS(FinancialData[Product]${filterClause}, "Total Sales", [Total Sales], "Total Profit", [Total Profit]) ORDER BY [Total Sales] DESC`;
            return await executeDaxQuery(dax);
        }
        case "get_sales_by_country_tool": {
            const dax = `EVALUATE SUMMARIZECOLUMNS(FinancialData[Country]${filterClause}, "Total Sales", [Total Sales]) ORDER BY [Total Sales] DESC`;
            return await executeDaxQuery(dax);
        }
        case "get_sales_by_segment_tool": {
            const dax = `EVALUATE SUMMARIZECOLUMNS(FinancialData[Segment]${filterClause}, "Total Sales", [Total Sales]) ORDER BY [Total Sales] DESC`;
            return await executeDaxQuery(dax);
        }
        case "get_discount_impact_tool": {
            const dax = `EVALUATE SUMMARIZECOLUMNS(FinancialData[Discount Band]${filterClause}, "Profit", [Total Profit], "Avg_Discount", AVERAGE(FinancialData[Discounts]))`;
            return await executeDaxQuery(dax);
        }
        case "get_sales_vs_forecast_tool": {
            const dax = `EVALUATE SUMMARIZECOLUMNS(FinancialData[Month Number], FinancialData[Month Name]${filterClause}, "Sales", [Total Sales], "Forecast", [Total Forecast]) ORDER BY FinancialData[Month Number]`;
            const res = await executeDaxQuery(dax);
            return res.map(r => ({
                "Month Name": r["Month Name"],
                Sales: r.Sales,
                Forecast: r.Forecast
            }));
        }
        case "get_records_tool": {
            const dax = `EVALUATE CALCULATETABLE(FinancialData${filterClause})`;
            const res = await executeDaxQuery(dax);
            // Format dates (YYYY-MM-DD)
            res.forEach(r => {
                if (r.Date) {
                    r.Date = new Date(r.Date).toISOString().split('T')[0];
                }
            });
            // Client-side pagination matching python logic
            const page = args.page || 1;
            const pageSize = args.page_size || 20;
            const start = (page - 1) * pageSize;
            return res.slice(start, start + pageSize);
        }
        default:
            throw new Error(`Unknown tool: ${name}`);
    }
}
