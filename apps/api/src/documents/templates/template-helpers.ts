/**
 * DEVELOPMENT_RULES.md §6: templates receive a prepared view model and
 * contain no business logic — string/HTML assembly only.
 */
export function escapeHtml(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** A labeled table cell — the recurring unit across every one of these forms. */
export function fieldCell(
  label: string,
  value: string | number | null | undefined,
  colspan?: number,
): string {
  const span = colspan ? ` colspan="${colspan}"` : '';
  const display =
    value === null || value === undefined || value === '' ? '&nbsp;' : escapeHtml(value);
  return `<td${span}><div class="label">${escapeHtml(label)}</div>${display}</td>`;
}

export function htmlDocument(title: string, pageCss: string, body: string): string {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 10pt; margin: 0; padding: 8mm; color: #000; }
  table { width: 100%; border-collapse: collapse; }
  td, th { border: 1px solid #000; padding: 3px 5px; vertical-align: top; font-size: 9pt; }
  .label { font-weight: bold; font-size: 7pt; text-transform: uppercase; color: #333; }
  .title { text-align: center; font-weight: bold; font-size: 13pt; margin-bottom: 6px; }
  .section-title { background: #ddd; font-weight: bold; padding: 3px 5px; font-size: 9pt; }
  .blank { color: #999; }
  ${pageCss}
</style>
</head>
<body>
${body}
</body>
</html>`;
}
