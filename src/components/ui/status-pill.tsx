import { orderStatusMeta } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function StatusPill({ status }: { status: string }) {
  const meta = orderStatusMeta[status] ?? {
    label: status,
    tone: "bg-zinc-100 text-zinc-900",
  };

  return (
    <span
      className={cn(
        "inline-flex rounded-full px-3 py-1 text-xs font-semibold",
        meta.tone,
      )}
    >
      {meta.label}
    </span>
  );
}
