import { AlertTriangle, CheckCircle2, Clock, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WashoutStatus } from "@/lib/washout";

const config: Record<
  WashoutStatus,
  { label: string; className: string; Icon: typeof CheckCircle2 }
> = {
  CLEARED: {
    label: "Cleared",
    className: "bg-success/12 text-success border-success/30",
    Icon: CheckCircle2,
  },
  PENDING: {
    label: "Pending",
    className: "bg-warning/12 text-warning border-warning/30",
    Icon: Clock,
  },
  PROHIBITED: {
    label: "Prohibited",
    className: "bg-destructive/12 text-destructive border-destructive/30",
    Icon: AlertTriangle,
  },
  UNKNOWN: {
    label: "Unknown",
    className: "bg-muted text-muted-foreground border-border",
    Icon: HelpCircle,
  },
};

export function StatusBadge({
  status,
  className,
}: {
  status: WashoutStatus;
  className?: string;
}) {
  const { label, className: tone, Icon } = config[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide",
        tone,
        className,
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {label}
    </span>
  );
}

export function RiskBadge({ risk }: { risk: "low" | "medium" | "high" | "unknown" }) {
  const tone =
    risk === "high"
      ? "bg-destructive/12 text-destructive border-destructive/30"
      : risk === "medium"
        ? "bg-warning/12 text-warning border-warning/30"
        : risk === "low"
          ? "bg-success/12 text-success border-success/30"
          : "bg-muted text-muted-foreground border-border";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
        tone,
      )}
    >
      {risk} risk
    </span>
  );
}
