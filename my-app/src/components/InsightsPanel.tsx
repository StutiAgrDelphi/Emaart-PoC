import React, { useEffect, useState } from 'react';
import { Sparkles, RefreshCw } from 'lucide-react';
import { fetchInsights } from '@/services/dataService';
import { cn } from '@/lib/utils';

function renderBold(text: string) {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) =>
        part.startsWith('**') && part.endsWith('**')
            ? <strong key={i} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>
            : <React.Fragment key={i}>{part}</React.Fragment>
    );
}

interface InsightsPanelProps {
    filters: any;
    kpis: any;
    salesByProduct: any[];
    salesByCountry: any[];
    salesBySegment: any[];
    discountImpact: any[];
    salesVsForecast: any[];
}

export function InsightsPanel({
    filters,
    kpis,
    salesByProduct,
    salesByCountry,
    salesBySegment,
    discountImpact,
    salesVsForecast
}: InsightsPanelProps) {
    const [bullets, setBullets] = useState<string[]>([]);
    const [generatedAt, setGeneratedAt] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = () => {
        if (!kpis) return; // Wait until dashboard data is loaded
        setLoading(true);
        setError(null);

        const payload = {
            filters,
            kpis,
            salesByProduct,
            salesByCountry,
            salesBySegment,
            discountImpact,
            salesVsForecast
        };

        fetchInsights(payload)
            .then((data) => {
                setBullets(data.bullets || []);
                setGeneratedAt(data.generated_at);
            })
            .catch((err) => {
                setError(err.message || 'Could not generate insights.');
            })
            .finally(() => setLoading(false));
    };

    // Auto-generate when underlying dashboard data changes
    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [kpis, salesByProduct, salesByCountry, salesBySegment, discountImpact, salesVsForecast]);

    const dateLabel = generatedAt
        ? new Date(generatedAt).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
        : '';

    return (
        <div className="bg-card text-card-foreground rounded-[var(--radius)] border border-border shadow-sm flex flex-col overflow-hidden h-full">
            <div className="flex items-center justify-between p-l border-b border-border bg-secondary/30">
                <div>
                    <h3 className="text-400 font-semibold font-heading flex items-center gap-xs">
                        <Sparkles size={16} className="text-primary" />
                        Executive Brief
                    </h3>
                    {dateLabel && <p className="text-200 text-muted-foreground mt-xs">{dateLabel}</p>}
                </div>
                <button
                    onClick={load}
                    disabled={loading}
                    className="p-s rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                    aria-label="Regenerate insights"
                >
                    <RefreshCw size={16} className={cn(loading && "animate-spin")} />
                </button>
            </div>

            <div className="p-l flex-1 overflow-auto">
                {error ? (
                    <div className="text-destructive text-300 p-m bg-destructive/10 rounded-md border border-destructive/20">{error}</div>
                ) : loading ? (
                    <div className="flex flex-col gap-m animate-pulse">
                        <div className="h-4 bg-secondary rounded w-3/4"></div>
                        <div className="h-4 bg-secondary rounded w-5/6"></div>
                        <div className="h-4 bg-secondary rounded w-4/5"></div>
                        <div className="h-4 bg-secondary rounded w-2/3"></div>
                    </div>
                ) : bullets.length === 0 ? (
                    <div className="text-muted-foreground text-300">No insights available for this selection.</div>
                ) : (
                    <ul className="space-y-m text-300 text-muted-foreground list-disc pl-l marker:text-primary/40">
                        {bullets.map((b, idx) => <li key={idx} className="leading-relaxed">{renderBold(b)}</li>)}
                    </ul>
                )}
            </div>
        </div>
    );
}
