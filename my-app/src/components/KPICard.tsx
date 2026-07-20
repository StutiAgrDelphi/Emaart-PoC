import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface KPICardProps {
    title: string;
    value: string | number;
    icon: ReactNode;
    colorClass?: string;
    className?: string;
}

export function KPICard({ title, value, icon, colorClass, className }: KPICardProps) {
    return (
        <div className={cn(
            "bg-card text-card-foreground rounded-[var(--radius)] border border-border p-l flex items-center gap-l shadow-sm transition-all hover:shadow-md",
            className
        )}>
            <div className={cn("flex items-center justify-center rounded-xl h-12 w-12", colorClass)}>
                {icon}
            </div>
            <div className="flex flex-col">
                <h4 className="text-300 font-medium text-muted-foreground tracking-wide uppercase text-[11px]">{title}</h4>
                <p className="text-600 font-numeric font-bold mt-xs">{value}</p>
            </div>
        </div>
    );
}
