import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency = "UZS") {
  return new Intl.NumberFormat("uz-UZ", {
    style: "currency",
    currency: currency,
    minimumFractionDigits: 0,
  }).format(amount);
}
