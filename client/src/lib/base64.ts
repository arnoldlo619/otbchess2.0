/**
 * Unicode-safe Base64 encoding/decoding utilities.
 *
 * Standard btoa/atob only handle Latin-1 characters. These helpers
 * properly encode/decode full Unicode (emoji, CJK, diacritics, etc.)
 * by converting to/from UTF-8 byte sequences first.
 */

/**
 * Encode a Unicode string to URL-safe base64.
 * Handles emoji, CJK, diacritics, em dashes, curly quotes, chess symbols, etc.
 */
export function utf8ToBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Decode a base64 string back to Unicode.
 * Reverses utf8ToBase64.
 */
export function base64ToUtf8(b64: string): string {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

/**
 * Safely encode tournament metadata to a URL-safe base64 parameter.
 * Returns the encoded string wrapped in encodeURIComponent for URL safety.
 */
export function encodeMetaParam(meta: Record<string, unknown>): string {
  return encodeURIComponent(utf8ToBase64(JSON.stringify(meta)));
}

/**
 * Safely decode a URL parameter back to tournament metadata.
 * Handles both new UTF-8 encoding and legacy Latin-1 btoa encoding for backward compatibility.
 * Returns null if decoding fails entirely.
 */
export function decodeMetaParam(param: string): Record<string, unknown> | null {
  // First try: decode as-is (may already be URL-decoded by URLSearchParams)
  let b64 = param;
  try {
    const json = base64ToUtf8(b64);
    return JSON.parse(json);
  } catch {
    // noop — try fallback
  }

  // Second try: URL-decode first (some QR scanners double-encode)
  try {
    b64 = decodeURIComponent(param);
    const json = base64ToUtf8(b64);
    return JSON.parse(json);
  } catch {
    // noop — try legacy
  }

  // Third try: legacy Latin-1 atob (backward compat with old invite links)
  try {
    const json = atob(param);
    return JSON.parse(json);
  } catch {
    // noop
  }

  try {
    const json = atob(decodeURIComponent(param));
    return JSON.parse(json);
  } catch {
    return null;
  }
}
