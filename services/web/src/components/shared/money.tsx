import { formatMoney } from "@/lib/utils";

interface MoneyProps {
  amount: number;       // integer minor units (cents)
  currency?: string;    // ISO 4217, defaults to CAD
  className?: string;
}

// Money values are ALWAYS monospaced + right-aligned (financial convention).
export function Money({ amount, currency = "CAD", className }: MoneyProps) {
  const isNegative = amount < 0;
  return (
    <span className={`money ${isNegative ? "text-unmatched" : ""} ${className ?? ""}`}>
      {formatMoney(amount, currency)}
    </span>
  );
}
