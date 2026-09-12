import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Merge conditional class names, resolving Tailwind conflicts (shadcn/ui convention). */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Escapes free-text values before interpolating them into a plain (non-React) print window's HTML string. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * A flight number as a single "CODE NNNN" string (e.g. "EK 0654") — the
 * 2-character airline IATA code (letters/digits), a space, then 4 digits.
 * Applied on every keystroke so the field self-formats as the user types.
 */
export function formatFlightNumber(value: string): string {
  const alnum = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const code = alnum.slice(0, 2);
  const digits = alnum.slice(2).replace(/\D/g, '').slice(0, 4);
  return digits ? `${code} ${digits}` : code;
}

/** Splits a "CODE NNNN" flight number into its airline code and flight digits. */
export function splitFlightNumber(value: string): { code: string; flightNo: string } {
  const [code = '', flightNo = ''] = value.trim().split(' ');
  return { code, flightNo };
}
