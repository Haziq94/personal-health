/**
 * CSV serialisation, for opening a log in a spreadsheet.
 *
 * Follows RFC 4180: fields are quoted when they contain a delimiter, a quote or
 * a line break, and embedded quotes are doubled. Rows are joined with CRLF,
 * which is what Excel expects.
 */

export type CsvValue = string | number | null | undefined;

const ROW_SEPARATOR = '\r\n';

/**
 * Quotes a single field.
 *
 * Leading or trailing spaces are quoted too — otherwise a spreadsheet strips
 * them and a food called " Rice" silently becomes "Rice".
 */
export function escapeCsvField(value: CsvValue): string {
  if (value === null || value === undefined) return '';

  const text = String(value);
  const needsQuotes =
    text.includes(',') ||
    text.includes('"') ||
    text.includes('\n') ||
    text.includes('\r') ||
    text !== text.trim();

  return needsQuotes ? `"${text.replaceAll('"', '""')}"` : text;
}

export function toCsvRow(fields: readonly CsvValue[]): string {
  return fields.map(escapeCsvField).join(',');
}

/** A full document: header row followed by the data rows. */
export function toCsv(
  headers: readonly string[],
  rows: readonly (readonly CsvValue[])[],
): string {
  return [toCsvRow(headers), ...rows.map(toCsvRow)].join(ROW_SEPARATOR);
}
