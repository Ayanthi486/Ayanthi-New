import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Merge conditional class names, resolving Tailwind conflicts (shadcn/ui convention). */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Escapes free-text values before interpolating them into a plain (non-React) print window's HTML string. */
export function escapeHtml(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * A flight number as a single "CODENNNN" string (e.g. "EK0654") — the
 * 2-character airline IATA code (letters/digits), then 4 digits.
 * Applied on every keystroke so the field self-formats as the user types.
 */
export function formatFlightNumber(value: string): string {
  const alnum = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const code = alnum.slice(0, 2);
  const digits = alnum.slice(2).replace(/\D/g, '').slice(0, 4);
  return digits.length > 0 ? `${code} ${digits}` : code;
}

/** Splits a "CODENNNN" flight number into its airline code and flight digits. */
export function splitFlightNumber(value: string): { code: string; flightNo: string } {
  const cleaned = value.trim().replace(/\s+/g, '');
  const code = cleaned.slice(0, 2);
  const flightNo = cleaned.slice(2);
  return { code, flightNo };
}

/** Formats an airline code and flight number into a clean string with a space (e.g. "UL 0123"). */
export function displayFlight(airlineCode: string | null | undefined, flightNo: string | null | undefined): string {
  if (!flightNo) return '—';
  const code = (airlineCode || '').trim();
  let fNo = flightNo.trim();
  
  if (code && fNo.toUpperCase().startsWith(code.toUpperCase())) {
    fNo = fNo.slice(code.length).trim();
  }
  
  if (/^\d+$/.test(fNo) && fNo.length < 4) {
    fNo = fNo.padStart(4, '0');
  }
  
  return code ? `${code} ${fNo}` : fNo;
}

/** 
 * Print an uploaded document (PDF or image). 
 * Images are scaled down to fit onto A4 paper.
 */
export function printFileBlob(blob: Blob, existingWindow?: Window | null) {
  if (blob.type.startsWith('image/')) {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      const html = `<!doctype html>
<html>
  <head>
    <title>Print Document</title>
    <style>
      @page { size: A4 portrait; margin: 15mm; }
      body { margin: 0; padding: 0; display: flex; justify-content: center; align-items: flex-start; min-height: 100vh; }
      img { max-width: 100%; max-height: 100%; object-fit: contain; }
    </style>
  </head>
  <body>
    <img src="${dataUrl}" />
    <script>
      window.onload = () => setTimeout(() => { window.print(); }, 200);
    </script>
  </body>
</html>`;
      const htmlBlob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(htmlBlob);
      if (existingWindow) {
        existingWindow.location.href = url;
      } else {
        window.open(url, '_blank');
      }
    };
    reader.readAsDataURL(blob);
  } else {
    const url = URL.createObjectURL(blob);
    if (existingWindow) {
      existingWindow.location.href = url;
    } else {
      window.open(url, '_blank');
    }
  }
}
