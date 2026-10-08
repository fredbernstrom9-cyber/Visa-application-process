import { describe, expect, it } from 'vitest';
import { autoMapColumns, buildImportRows, missingRequired, parseDateCell, parseStage, parseVisaType, type ImportOptions } from '@/lib/import/mapping';
import { toCsv, safeText } from '@/lib/export';

const opts = (over: Partial<ImportOptions> = {}): ImportOptions => ({
  dateFormat: 'dmy', defaults: {}, members: [{ id: 'u1', name: 'Pia Advisor', email: 'pia@school.edu' }], ...over,
});

describe('autoMapColumns', () => {
  it('matches common headers regardless of case, punctuation and order', () => {
    const m = autoMapColumns(['Student Name', 'E-mail Address', 'Citizenship', 'Destination Country', 'Visa Category', 'Course Start', 'Cohort', 'Assigned To', 'Remarks']);
    expect(m).toMatchObject({ full_name: 0, email: 1, nationality: 2, destination: 3, visa_type: 4, start_date: 5, intake: 6, advisor: 7, notes: 8 });
  });
  it('maps first/last name separately and keeps a bare "Country" as a weak destination match', () => {
    const m = autoMapColumns(['First Name', 'Surname', 'Country', 'Nationality']);
    expect(m.first_name).toBe(0);
    expect(m.last_name).toBe(1);
    expect(m.nationality).toBe(3);
    expect(m.destination).toBe(2);
  });
  it('never maps one column to two fields', () => {
    const m = autoMapColumns(['Name', 'Name']);
    const cols = Object.values(m).filter((v) => v !== null && v !== undefined);
    expect(new Set(cols).size).toBe(cols.length);
  });
  it('does not guess for unrelated headers', () => {
    expect(autoMapColumns(['Foo', 'Bar', '#'])).toEqual({});
  });
});

describe('parseDateCell', () => {
  it.each([
    ['2026-09-01', 'dmy', '2026-09-01'],
    ['01/09/2026', 'dmy', '2026-09-01'],
    ['01/09/2026', 'mdy', '2026-01-09'],
    ['13.02.26', 'dmy', '2026-02-13'],
    ['1 Sep 2026', 'dmy', '2026-09-01'],
    ['September 1, 2026', 'dmy', '2026-09-01'],
    ['2026-09-01T10:00:00Z', 'dmy', '2026-09-01'],
  ] as const)('parses %s (%s)', (input, fmt, expected) => {
    expect(parseDateCell(input, fmt)).toBe(expected);
  });
  it('handles Excel serials, Date objects, blanks and invalid input', () => {
    expect(parseDateCell(46266)).toBe('2026-09-01');
    expect(parseDateCell(new Date(Date.UTC(2026, 8, 1)))).toBe('2026-09-01');
    expect(parseDateCell('')).toBeNull();
    expect(parseDateCell(null)).toBeNull();
    expect(parseDateCell('31/02/2026')).toBe('invalid');
    expect(parseDateCell('soon')).toBe('invalid');
    expect(parseDateCell(12)).toBe('invalid');
  });
});

describe('enum parsers', () => {
  it('visa types', () => {
    expect(parseVisaType('Type C')).toBe('C');
    expect(parseVisaType('long stay')).toBe('D');
    expect(parseVisaType('Student')).toBe('D');
    expect(parseVisaType('other')).toBe('other');
    expect(parseVisaType('???')).toBeNull();
  });
  it('stages', () => {
    expect(parseStage('Signed')).toBe('admitted');
    expect(parseStage('Docs')).toBe('documents');
    expect(parseStage('visa granted')).toBe('approved');
    expect(parseStage('Rejected')).toBe('refused');
    expect(parseStage('Decision_pending')).toBe('decision_pending');
    expect(parseStage('whatever')).toBeNull();
  });
});

describe('buildImportRows', () => {
  const headers = ['Name', 'Email', 'Nationality', 'Destination', 'Visa', 'Start', 'Advisor', 'Stage', 'Tags'];
  const mapping = autoMapColumns(headers);

  it('turns valid rows into payloads and reports per-row problems', () => {
    const data = [
      ['Asha Rao', 'ASHA@x.test', 'India', 'France', 'D', '01/09/2026', 'pia@school.edu', 'Documents', 'vip; scholarship'],
      ['Bad Dest', 'b@x.test', 'Nigeria', 'Narnia', 'D', '', '', '', ''],
      ['Bad Date', 'c@x.test', 'IN', 'DE', 'C', '31/02/2026', '', '', ''],
      ['', 'd@x.test', 'IN', 'DE', '', '', '', '', ''],
      ['Not EU', 'e@x.test', 'IN', 'United States', '', '', '', '', ''],
      ['Bad Mail', 'nope', 'IN', 'DE', '', '', '', '', ''],
      ['Ghost Advisor', 'g@x.test', 'IN', 'ES', '', '', 'Unknown Person', '', ''],
      ['', '', '', '', '', '', '', '', ''],
    ];
    const r = buildImportRows(data, mapping, opts());
    expect(r.rows.map((x) => x.full_name)).toEqual(['Asha Rao', 'Ghost Advisor']);
    expect(r.rows[0]).toMatchObject({
      idx: 2, email: 'asha@x.test', nationality: 'IN', destination: 'FR', visa_type: 'D', start_date: '2026-09-01',
      assigned_to: 'u1', stage: 'documents', tags: ['vip', 'scholarship'],
    });
    expect(r.rows[1].assigned_to).toBeNull();
    expect(r.warnings.map((w) => w.field)).toContain('advisor');
    expect(r.errorRowCount).toBe(5);
    expect(r.blankRows).toBe(1);
    const byRow = Object.fromEntries(r.errors.map((e) => [e.row, e.message]));
    expect(byRow[3]).toMatch(/Unknown destination/);
    expect(byRow[4]).toMatch(/not a valid date/);
    expect(byRow[5]).toMatch(/Name is missing/);
    expect(byRow[6]).toMatch(/not an EU \/ Schengen destination/);
    expect(byRow[7]).toMatch(/not a valid e-mail/);
  });

  it('applies defaults when columns are absent and combines first + last name', () => {
    const m = autoMapColumns(['First name', 'Last name']);
    const r = buildImportRows([['Li', 'Wei']], m, opts({ defaults: { destination: 'NL', visaType: 'D', intake: 'Sep 2027', stage: 'documents', advisorId: 'u1' } }));
    expect(r.errors).toEqual([]);
    expect(r.rows[0]).toMatchObject({ full_name: 'Li Wei', destination: 'NL', visa_type: 'D', intake: 'Sep 2027', stage: 'documents', assigned_to: 'u1' });
  });

  it('warns when decided cases have no decision date', () => {
    const m = autoMapColumns(['Name', 'Destination', 'Status']);
    const r = buildImportRows([['A', 'FR', 'approved']], m, opts());
    expect(r.warnings.map((w) => w.field)).toEqual(expect.arrayContaining(['decision_on', 'submitted_on']));
  });

  it('reports missing required mappings', () => {
    expect(missingRequired({}, {})).toEqual(['Full name', 'Destination']);
    expect(missingRequired({ first_name: 0, destination: 1 }, {})).toEqual([]);
    expect(missingRequired({ full_name: 0 }, { destination: 'FR' })).toEqual([]);
  });
});

describe('CSV export safety', () => {
  it('neutralises spreadsheet formulas and escapes delimiters', () => {
    expect(safeText('=HYPERLINK("x")')).toBe(`'=HYPERLINK("x")`);
    expect(safeText('+1')).toBe("'+1");
    expect(safeText('@cmd')).toBe("'@cmd");
    expect(safeText('Anna')).toBe('Anna');
    const csv = toCsv(['a', 'b'], [['=1+1', 'x,"y"'], [5, null]]);
    expect(csv).toContain(`'=1+1,"x,""y"""`);
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv).toContain('5,');
  });
});
