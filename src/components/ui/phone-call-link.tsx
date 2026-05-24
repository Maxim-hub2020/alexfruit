import { Phone } from "lucide-react";
import { getPhoneHref } from "@/lib/phone";
import { cn } from "@/lib/utils";

export function PhoneCallLink({
  phone,
  label = "Позвонить",
  className,
  showPhone = true,
}: {
  phone?: string | null;
  label?: string;
  className?: string;
  showPhone?: boolean;
}) {
  const href = getPhoneHref(phone);

  if (!href) {
    return (
      <span className={cn("inline-flex items-center text-[var(--muted)]", className)}>
        без телефона
      </span>
    );
  }

  return (
    <a
      href={`tel:${href}`}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-900 ring-1 ring-emerald-100 transition hover:bg-emerald-100",
        className,
      )}
      title={`Позвонить ${phone ?? href}`}
    >
      <Phone size={13} />
      {label}
      {showPhone && phone ? <span className="font-medium opacity-80">{phone}</span> : null}
    </a>
  );
}
