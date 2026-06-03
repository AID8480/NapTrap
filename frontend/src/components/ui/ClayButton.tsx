import type { ButtonHTMLAttributes, ReactNode } from "react";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: "primary" | "ghost";
  colorClass?: string;
}

export function ClayButton({ children, variant = "primary", colorClass = "bg-coral text-white", className = "", ...rest }: Props) {
  const base =
    "clay-shadow-btn rounded-2xl px-5 py-2.5 font-semibold text-sm transition-all duration-100 active:scale-95 select-none disabled:opacity-50 disabled:cursor-not-allowed";
  const variantClass = variant === "ghost"
    ? "bg-white/60 text-gray-700 hover:bg-white/80"
    : colorClass;

  return (
    <button className={`${base} ${variantClass} ${className}`} {...rest}>
      {children}
    </button>
  );
}
