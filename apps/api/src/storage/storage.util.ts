/**
 * ARCHITECTURE §12: "MIME + magic-byte validation." A hand-rolled sniff for
 * exactly the closed set of receipt types this phase allows (PDF/JPEG/PNG) —
 * see the Phase 6 report for why this isn't a library (`file-type` is
 * ESM-only; this API package is CommonJS).
 */
export type AllowedFileKind = 'pdf' | 'jpeg' | 'png';

const ALLOWED_MIME_TYPES: Record<string, AllowedFileKind> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpeg',
  'image/png': 'png',
};

const EXTENSION_BY_KIND: Record<AllowedFileKind, string> = {
  pdf: 'pdf',
  jpeg: 'jpg',
  png: 'png',
};

function sniffFileKind(buffer: Buffer): AllowedFileKind | null {
  if (buffer.subarray(0, 5).toString('latin1') === '%PDF-') return 'pdf';
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpeg';
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'png';
  }
  return null;
}

/**
 * Both the client-declared MIME type and the file's own magic bytes must
 * agree on the same allowed kind — a mismatch (wrong extension, corrupted
 * upload, or a deliberately mislabeled file) is rejected either way.
 */
export function validateFileKind(declaredMimeType: string, buffer: Buffer): AllowedFileKind | null {
  const declaredKind = ALLOWED_MIME_TYPES[declaredMimeType];
  if (!declaredKind) return null;
  const sniffedKind = sniffFileKind(buffer);
  if (sniffedKind !== declaredKind) return null;
  return declaredKind;
}

export function extensionForKind(kind: AllowedFileKind): string {
  return EXTENSION_BY_KIND[kind];
}

const MIME_TYPE_BY_EXTENSION: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  png: 'image/png',
};

/** Reverse of extensionForKind, for serving a stored file back with its Content-Type. */
export function mimeTypeForKey(key: string): string {
  const extension = key.split('.').pop()?.toLowerCase() ?? '';
  return MIME_TYPE_BY_EXTENSION[extension] ?? 'application/octet-stream';
}
