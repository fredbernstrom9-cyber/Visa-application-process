import { renderToBuffer } from '@react-pdf/renderer';
import { describe, expect, it } from 'vitest';
import { IntakeReport, type IntakeReportModel } from '@/lib/reports/intake';

const model: IntakeReportModel = {
  orgName: 'Northbridge Business School',
  title: 'Intake summary: Sep 2027',
  filterSummary: 'Intake: Sep 2027 · Destination: FR, DE',
  generatedOn: '2026-10-05',
  generatedBy: 'by Olivia Owner',
  kpis: [
    { label: 'Applicants in scope', value: '128' }, { label: 'Active cases', value: '64' },
    { label: 'Acceptance rate', value: '87.5%', note: '56 approved · 8 refused' }, { label: 'High-risk open cases', value: '9' },
    { label: 'Median days, admission to decision', value: '41 d' }, { label: 'Documents verified (open cases)', value: '72.4%' },
  ],
  funnel: [
    { label: 'Admitted', value: 128, conversion: null }, { label: 'Documents started', value: 120, conversion: 94 }, { label: 'Appointment booked', value: 101, conversion: 84 },
    { label: 'Submitted', value: 90, conversion: 89 }, { label: 'Decision pending', value: 70, conversion: 78 }, { label: 'Decision made', value: 64, conversion: 91 }, { label: 'Approved', value: 56, conversion: 88 },
  ],
  acceptance: [{ key: 'FR', decided: 30, approved: 27, rate: 90 }, { key: 'DE', decided: 20, approved: 17, rate: 85 }, { key: 'ES', decided: 3, approved: 2, rate: 66.7 }],
  risk: { high: 9, medium: 14, low: 38, unscored: 3 },
  slowestStage: { label: 'Documents in progress', days: 18.2 },
};

describe('intake summary PDF', () => {
  it('renders a valid single-page PDF', async () => {
    const buf = await renderToBuffer(<IntakeReport m={model} />);
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(buf.length).toBeGreaterThan(2_000);
    const pages = buf.toString('latin1').match(/\/Type \/Page\b(?!s)/g) ?? [];
    expect(pages).toHaveLength(1);
  });
  it('still fits one page with no data', async () => {
    const empty: IntakeReportModel = { ...model, kpis: model.kpis.map((k) => ({ ...k, value: '-', note: undefined })), funnel: model.funnel.map((f) => ({ ...f, value: 0, conversion: null })), acceptance: [], risk: { high: 0, medium: 0, low: 0, unscored: 0 }, slowestStage: null };
    const buf = await renderToBuffer(<IntakeReport m={empty} />);
    expect((buf.toString('latin1').match(/\/Type \/Page\b(?!s)/g) ?? []).length).toBe(1);
  });
});
