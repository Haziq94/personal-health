import { describe, expect, it } from 'vitest';

import { escapeCsvField, toCsv, toCsvRow } from '@/domain/csv';

describe('escapeCsvField', () => {
  it('leaves plain values alone', () => {
    expect(escapeCsvField('Rice')).toBe('Rice');
    expect(escapeCsvField(42)).toBe('42');
  });

  it('renders null and undefined as empty', () => {
    expect(escapeCsvField(null)).toBe('');
    expect(escapeCsvField(undefined)).toBe('');
  });

  it('quotes fields containing the delimiter', () => {
    expect(escapeCsvField('Rice, fried')).toBe('"Rice, fried"');
  });

  it('doubles embedded quotes', () => {
    expect(escapeCsvField('6" sub')).toBe('"6"" sub"');
    expect(escapeCsvField('say "hi"')).toBe('"say ""hi"""');
  });

  it('quotes fields containing line breaks', () => {
    expect(escapeCsvField('line one\nline two')).toBe('"line one\nline two"');
    expect(escapeCsvField('carriage\rreturn')).toBe('"carriage\rreturn"');
  });

  it('quotes surrounding spaces so a spreadsheet cannot strip them', () => {
    expect(escapeCsvField(' Rice')).toBe('" Rice"');
    expect(escapeCsvField('Rice ')).toBe('"Rice "');
  });
});

describe('toCsvRow', () => {
  it('joins fields with commas', () => {
    expect(toCsvRow(['a', 1, null])).toBe('a,1,');
  });
});

describe('toCsv', () => {
  it('writes a header row then the data, separated by CRLF', () => {
    const csv = toCsv(
      ['name', 'kcal'],
      [
        ['Rice', 200],
        ['Nasi lemak, special', 550],
      ],
    );

    expect(csv).toBe('name,kcal\r\nRice,200\r\n"Nasi lemak, special",550');
  });

  it('writes just the header when there are no rows', () => {
    expect(toCsv(['name', 'kcal'], [])).toBe('name,kcal');
  });
});
