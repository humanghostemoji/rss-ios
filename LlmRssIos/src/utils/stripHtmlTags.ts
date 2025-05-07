// src/utils/stripHtmlTags.ts

/**
 * Removes HTML tags from a string.
 * @param html The HTML string.
 * @returns The string with HTML tags removed.
 */
export function stripHtmlTags(html: string): string {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, '');
}
