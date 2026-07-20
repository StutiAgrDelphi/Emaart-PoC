import { VegaVisual, useCssTheme } from "@microsoft/fabric-visuals";

// Helper for formatting currency in Vega-Lite
const formatCurrency = "$s";

export function SalesTrendChart({ data }: { data: any[] }) {
    const theme = useCssTheme();
    const spec: any = {
        data: { values: data },
        layer: [
            {
                mark: { type: "bar", color: "var(--color-primary)", cornerRadiusEnd: 4 },
                encoding: {
                    x: { field: "Period", type: "ordinal", axis: { labelAngle: 0 } },
                    y: { field: "Sales", type: "quantitative", axis: { format: formatCurrency } }
                }
            },
            {
                mark: { type: "line", color: "var(--color-brand-foreground)", strokeWidth: 3, point: true },
                encoding: {
                    x: { field: "Period", type: "ordinal" },
                    y: { field: "Profit", type: "quantitative" }
                }
            }
        ]
    };
    return <VegaVisual spec={spec} theme={theme} />;
}

export function SalesByProductChart({ data }: { data: any[] }) {
    const theme = useCssTheme();
    const spec: any = {
        data: { values: data },
        mark: { type: "bar", color: "var(--color-primary)", cornerRadiusEnd: 4 },
        encoding: {
            y: { field: "Product", type: "nominal", sort: "-x", title: null },
            x: { field: "Total Sales", type: "quantitative", axis: { format: formatCurrency } },
            tooltip: [{ field: "Total Sales", type: "quantitative", format: formatCurrency }]
        }
    };
    return <VegaVisual spec={spec} theme={theme} />;
}

export function SalesByCountryChart({ data }: { data: any[] }) {
    const theme = useCssTheme();
    const spec: any = {
        data: { values: data },
        mark: { type: "bar", color: "var(--color-primary)", cornerRadiusEnd: 4 },
        encoding: {
            x: { field: "Country", type: "nominal", sort: "-y", title: null, axis: { labelAngle: 0 } },
            y: { field: "Total Sales", type: "quantitative", axis: { format: formatCurrency } },
            tooltip: [{ field: "Total Sales", type: "quantitative", format: formatCurrency }]
        }
    };
    return <VegaVisual spec={spec} theme={theme} />;
}

export function SalesBySegmentChart({ data }: { data: any[] }) {
    const theme = useCssTheme();
    const spec: any = {
        data: { values: data },
        mark: { type: "arc", innerRadius: 50 },
        encoding: {
            theta: { field: "Total Sales", type: "quantitative" },
            color: { field: "Segment", type: "nominal", scale: { scheme: "category10" } },
            tooltip: [{ field: "Total Sales", type: "quantitative", format: formatCurrency }]
        }
    };
    return <VegaVisual spec={spec} theme={theme} />;
}

export function DiscountImpactChart({ data }: { data: any[] }) {
    const theme = useCssTheme();
    const spec: any = {
        data: { values: data },
        mark: { type: "bar", color: "var(--color-primary)", cornerRadiusEnd: 4 },
        encoding: {
            x: { field: "Discount Band", type: "nominal", title: null, axis: { labelAngle: 0 } },
            y: { field: "Profit", type: "quantitative", axis: { format: formatCurrency } },
            tooltip: [{ field: "Profit", type: "quantitative", format: formatCurrency }]
        }
    };
    return <VegaVisual spec={spec} theme={theme} />;
}

export function SalesVsForecastChart({ data }: { data: any[] }) {
    const theme = useCssTheme();
    const spec: any = {
        data: { values: data },
        transform: [
            {
                fold: ["Sales", "Forecast"],
                as: ["Metric", "Value"]
            }
        ],
        mark: { type: "bar", cornerRadiusEnd: 4 },
        encoding: {
            x: { field: "Month Name", type: "nominal", title: null, axis: { labelAngle: 0 } },
            xOffset: { field: "Metric" },
            y: { field: "Value", type: "quantitative", axis: { format: formatCurrency } },
            color: { 
                field: "Metric", 
                type: "nominal",
                scale: { range: ["var(--color-primary)", "var(--color-muted-foreground)"] }
            },
            tooltip: [{ field: "Value", type: "quantitative", format: formatCurrency }]
        }
    };
    return <VegaVisual spec={spec} theme={theme} />;
}
