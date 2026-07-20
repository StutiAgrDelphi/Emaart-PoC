import { useState, useEffect } from 'react';
import { DollarSign, TrendingUp, Package, Percent, LayoutDashboard } from 'lucide-react';
import { useCssTheme } from "@microsoft/fabric-visuals";

import {
    fetchFilterValues, fetchKPIs, fetchSalesTrend, fetchSalesByProduct,
    fetchSalesByCountry, fetchSalesBySegment, fetchDiscountImpact,
    fetchSalesVsForecast, DashboardFilters
} from '@/services/dataService';

import { KPICard } from '@/components/KPICard';
import { InsightsPanel } from '@/components/InsightsPanel';
import { ChatWidget } from '@/components/ChatWidget';
import {
    SalesTrendChart, SalesByProductChart, SalesByCountryChart,
    SalesBySegmentChart, DiscountImpactChart, SalesVsForecastChart
} from '@/components/DashboardCharts';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useAppTheme } from '@/hooks/use-theme';

const formatCurrency = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);
const formatNumber = (val: number) => new Intl.NumberFormat('en-US').format(val);

export default function App() {
    const { toggleTheme, isDark } = useAppTheme();
    const vegaTheme = useCssTheme();

    const [filtersData, setFiltersData] = useState<any>({});
    const [selectedFilters, setSelectedFilters] = useState<DashboardFilters>({
        year: '', month: '', product: '', segment: '', country: '', discount_band: ''
    });

    const [kpis, setKpis] = useState<any>(null);
    const [salesTrend, setSalesTrend] = useState<any[]>([]);
    const [salesByProduct, setSalesByProduct] = useState<any[]>([]);
    const [salesByCountry, setSalesByCountry] = useState<any[]>([]);
    const [salesBySegment, setSalesBySegment] = useState<any[]>([]);
    const [discountImpact, setDiscountImpact] = useState<any[]>([]);
    const [salesVsForecast, setSalesVsForecast] = useState<any[]>([]);

    const [loading, setLoading] = useState(true);
    const [filtersError, setFiltersError] = useState(false);

    useEffect(() => {
        fetchFilterValues()
            .then(data => {
                setFiltersData(data);
                setFiltersError(false);
            })
            .catch(err => {
                console.error("Failed to load filters:", err);
                setFiltersError(true);
            });
    }, []);

    useEffect(() => {
        setLoading(true);
        Promise.all([
            fetchKPIs(selectedFilters),
            fetchSalesTrend(selectedFilters),
            fetchSalesByProduct(selectedFilters),
            fetchSalesByCountry(selectedFilters),
            fetchSalesBySegment(selectedFilters),
            fetchDiscountImpact(selectedFilters),
            fetchSalesVsForecast(selectedFilters)
        ]).then(([kpisData, trend, product, country, segment, discount, forecast]) => {
            setKpis(kpisData);
            setSalesTrend(trend);
            setSalesByProduct(product);
            setSalesByCountry(country);
            setSalesBySegment(segment);
            setDiscountImpact(discount);
            setSalesVsForecast(forecast);
        }).catch(console.error).finally(() => setLoading(false));
    }, [selectedFilters]);


    const handleFilterChange = (key: keyof DashboardFilters, value: string) => {
        setSelectedFilters(prev => ({ ...prev, [key]: value }));
    };

    const clearFilters = () => {
        setSelectedFilters({ year: '', month: '', product: '', segment: '', country: '', discount_band: '' });
    };


    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col font-base">
            {/* Header */}
            <header className="sticky top-0 z-40 w-full border-b border-border bg-background/80 backdrop-blur-md shadow-sm">
                <div className="flex h-16 items-center px-l justify-between max-w-[1600px] mx-auto w-full">
                    <div className="flex items-center gap-m">
                        <div className="h-10 w-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center">
                            <LayoutDashboard size={22} />
                        </div>
                        <div>
                            <h1 className="text-500 font-bold font-heading tracking-tight leading-none">Emaart Financial</h1>
                            <p className="text-200 text-muted-foreground mt-xs">Sales Performance Dashboard</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-m">
                        <ThemeToggle isDark={isDark} toggleTheme={toggleTheme} />
                        <button
                            onClick={clearFilters}
                            className="bg-secondary text-secondary-foreground hover:bg-secondary/80 px-m py-s rounded-md text-300 font-medium transition-colors"
                        >
                            Clear Filters
                        </button>
                    </div>
                </div>
            </header>

            <main className="flex-1 p-l max-w-[1600px] mx-auto w-full flex flex-col gap-l">
                {filtersError && (
                    <div className="bg-destructive/10 text-destructive border border-destructive/20 p-m rounded-xl">
                        <strong>Error:</strong> Could not load filters. Ensure Semantic Model is accessible.
                    </div>
                )}

                {/* Slicers */}
                <div className="bg-card border border-border rounded-[var(--radius)] p-m shadow-sm flex flex-wrap gap-m items-center">
                    {[
                        { label: 'Year', key: 'year', options: filtersData?.years },
                        { label: 'Month', key: 'month', options: filtersData?.months },
                        { label: 'Product', key: 'product', options: filtersData?.products },
                        { label: 'Segment', key: 'segment', options: filtersData?.segments },
                        { label: 'Country', key: 'country', options: filtersData?.countries },
                        { label: 'Discount Band', key: 'discount_band', options: filtersData?.discount_bands },
                    ].map(filter => (
                        <div key={filter.key} className="flex flex-col gap-xs min-w-[140px] flex-1">
                            <label className="text-200 font-medium text-muted-foreground uppercase tracking-wider">{filter.label}</label>
                            <select
                                className="bg-background border border-input rounded-md p-xs text-300 focus:ring-1 focus:ring-ring outline-none"
                                value={selectedFilters[filter.key as keyof DashboardFilters] || ''}
                                onChange={(e) => handleFilterChange(filter.key as keyof DashboardFilters, e.target.value)}
                            >
                                <option value="">All</option>
                                {filter.options?.map((opt: string | number) => (
                                    <option key={opt} value={opt}>{opt}</option>
                                ))}
                            </select>
                        </div>
                    ))}
                </div>

                {loading ? (
                    <div className="flex-1 flex items-center justify-center min-h-[400px]">
                        <div className="animate-pulse flex flex-col items-center gap-m">
                            <div className="h-12 w-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                            <p className="text-300 text-muted-foreground font-medium">Loading Dashboard Data...</p>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* KPIs & Insights Row */}
                        <div className="grid grid-cols-1 lg:grid-cols-4 gap-l">
                            <div className="lg:col-span-3 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-m content-start">
                                <KPICard title="Total Sales" value={formatCurrency(kpis?.total_sales || 0)} icon={<DollarSign size={24} />} colorClass="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" />
                                <KPICard title="Total Profit" value={formatCurrency(kpis?.total_profit || 0)} icon={<TrendingUp size={24} />} colorClass="bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400" />
                                <KPICard title="Units Sold" value={formatNumber(kpis?.total_units_sold || 0)} icon={<Package size={24} />} colorClass="bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400" />
                                <KPICard title="Profit Margin" value={`${(kpis?.profit_margin_pct || 0).toFixed(1)}%`} icon={<Percent size={24} />} colorClass="bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400" />
                                <KPICard title="Avg Discount" value={`${(kpis?.avg_discount_pct || 0).toFixed(1)}%`} icon={<TrendingUp size={24} />} colorClass="bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400" />
                            </div>
                            <div className="lg:col-span-1 min-h-[250px]">
                                <InsightsPanel
                                    filters={selectedFilters}
                                    kpis={kpis}
                                    salesByProduct={salesByProduct}
                                    salesByCountry={salesByCountry}
                                    salesBySegment={salesBySegment}
                                    discountImpact={discountImpact}
                                    salesVsForecast={salesVsForecast}
                                />
                            </div>
                        </div>

                        {/* Charts Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-l">
                            <div className="bg-card border border-border rounded-[var(--radius)] p-m shadow-sm flex flex-col h-[350px]">
                                <h3 className="text-300 font-semibold mb-m">Sales & Profit Trend</h3>
                                <div className="flex-1 w-full relative">
                                    <SalesTrendChart data={salesTrend} />
                                </div>
                            </div>
                            
                            <div className="bg-card border border-border rounded-[var(--radius)] p-m shadow-sm flex flex-col h-[350px]">
                                <h3 className="text-300 font-semibold mb-m">Sales by Product</h3>
                                <div className="flex-1 w-full relative">
                                    <SalesByProductChart data={salesByProduct} />
                                </div>
                            </div>

                            <div className="bg-card border border-border rounded-[var(--radius)] p-m shadow-sm flex flex-col h-[350px]">
                                <h3 className="text-300 font-semibold mb-m">Sales by Country</h3>
                                <div className="flex-1 w-full relative">
                                    <SalesByCountryChart data={salesByCountry} />
                                </div>
                            </div>

                            <div className="bg-card border border-border rounded-[var(--radius)] p-m shadow-sm flex flex-col h-[350px]">
                                <h3 className="text-300 font-semibold mb-m">Sales Share by Segment</h3>
                                <div className="flex-1 w-full relative">
                                    <SalesBySegmentChart data={salesBySegment} />
                                </div>
                            </div>

                            <div className="bg-card border border-border rounded-[var(--radius)] p-m shadow-sm flex flex-col h-[350px]">
                                <h3 className="text-300 font-semibold mb-m">Profit by Discount Band</h3>
                                <div className="flex-1 w-full relative">
                                    <DiscountImpactChart data={discountImpact} />
                                </div>
                            </div>

                            <div className="bg-card border border-border rounded-[var(--radius)] p-m shadow-sm flex flex-col h-[350px]">
                                <h3 className="text-300 font-semibold mb-m">Sales vs Forecast</h3>
                                <div className="flex-1 w-full relative">
                                    <SalesVsForecastChart data={salesVsForecast} />
                                </div>
                            </div>
                        </div>

                    </>
                )}
            </main>

            <ChatWidget />
        </div>
    );
}
