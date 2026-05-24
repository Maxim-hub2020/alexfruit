import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
};

const variants: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary:
    "bg-[var(--accent)] text-white shadow-[0_16px_30px_rgba(47,143,79,0.26)] hover:bg-[var(--accent-strong)]",
  secondary:
    "bg-[var(--accent-soft)] text-[var(--accent-strong)] hover:bg-[#d2eacc]",
  ghost:
    "bg-white/70 text-[var(--foreground)] ring-1 ring-[var(--line)] hover:bg-white",
  danger:
    "bg-[var(--danger)] text-white hover:bg-[#d54d3f]",
};

export function Button({
  className,
  variant = "primary",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex min-h-11 items-center justify-center rounded-2xl px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
