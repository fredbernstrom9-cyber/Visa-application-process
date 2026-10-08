import { Document, Page, Path, Rect, StyleSheet, Svg, Text, View } from '@react-pdf/renderer';
import { countryName } from '@/lib/countries';

export interface IntakeReportModel {
  orgName: string;
  title: string;
  filterSummary: string;
  generatedOn: string;
  generatedBy: string;
  kpis: { label: string; value: string; note?: string }[];
  funnel: { label: string; value: number; conversion: number | null }[];
  acceptance: { key: string; decided: number; approved: number; rate: number }[];
  risk: { low: number; medium: number; high: number; unscored: number };
  slowestStage: { label: string; days: number } | null;
}

// Palette mirrors the dashboard tokens (light mode only: reports are printed / shared as PDFs).
const C = { ink: '#16192a', muted: '#5b6275', line: '#e3e5ec', primary: '#2a78d6', track: '#e6eefb', low: '#0ca30c', med: '#fab219', high: '#d03b3b', neutral: '#8a93a6', panel: '#f5f6fa' };

const s = StyleSheet.create({
  page: { padding: 36, fontFamily: 'Helvetica', fontSize: 9, color: C.ink },
  header: { flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1.5, borderBottomColor: C.primary, paddingBottom: 10, marginBottom: 14 },
  h1: { fontSize: 18, fontFamily: 'Helvetica-Bold' },
  sub: { color: C.muted, marginTop: 3 },
  h2: { fontSize: 11, fontFamily: 'Helvetica-Bold', marginBottom: 6 },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4, marginBottom: 12 },
  kpi: { width: '33.33%', padding: 4 },
  kpiBox: { backgroundColor: C.panel, borderRadius: 4, padding: 8 },
  kpiValue: { fontSize: 17, fontFamily: 'Helvetica-Bold', marginTop: 2 },
  kpiLabel: { color: C.muted, fontSize: 8 },
  cols: { flexDirection: 'row', marginHorizontal: -6 },
  col: { flex: 1, paddingHorizontal: 6 },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  rowLabel: { width: 92, fontSize: 8.5 },
  barWrap: { flex: 1, height: 10 },
  rowValue: { width: 64, textAlign: 'right', fontSize: 8.5 },
  foot: { position: 'absolute', left: 36, right: 36, bottom: 24, borderTopWidth: 0.5, borderTopColor: C.line, paddingTop: 6, color: C.muted, fontSize: 7.5 },
});

function Bar({ pct, color = C.primary, width = 150 }: { pct: number; color?: string; width?: number }) {
  const w = Math.max(0, Math.min(100, pct)) / 100 * width;
  return (
    <Svg width={width} height={10}>
      <Rect x={0} y={0} width={width} height={10} rx={3} fill={C.track} />
      {w > 0 && <Path d={`M0 0 H${Math.max(w - 3, 0)} Q${w} 0 ${w} 3 V7 Q${w} 10 ${Math.max(w - 3, 0)} 10 H0 Z`} fill={color} />}
    </Svg>
  );
}

export function IntakeReport({ m }: { m: IntakeReportModel }) {
  const maxFunnel = Math.max(1, ...m.funnel.map((f) => f.value));
  const openTotal = m.risk.low + m.risk.medium + m.risk.high + m.risk.unscored;
  return (
    <Document title={`${m.title} - ${m.orgName}`} author={m.orgName} creator="ClearEntry Teams">
      <Page size="A4" style={s.page} wrap={false}>
        <View style={s.header}>
          <View>
            <Text style={s.h1}>{m.title}</Text>
            <Text style={s.sub}>{m.orgName}</Text>
            <Text style={s.sub}>{m.filterSummary}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ color: C.muted }}>Generated {m.generatedOn}</Text>
            <Text style={{ color: C.muted }}>{m.generatedBy}</Text>
          </View>
        </View>

        <View style={s.kpiGrid}>
          {m.kpis.map((k) => (
            <View key={k.label} style={s.kpi}>
              <View style={s.kpiBox}>
                <Text style={s.kpiLabel}>{k.label}</Text>
                <Text style={s.kpiValue}>{k.value}</Text>
                {k.note ? <Text style={{ ...s.kpiLabel, marginTop: 1 }}>{k.note}</Text> : null}
              </View>
            </View>
          ))}
        </View>

        <View style={s.cols}>
          <View style={s.col}>
            <Text style={s.h2}>Pipeline funnel</Text>
            {m.funnel.map((f) => (
              <View key={f.label} style={s.row}>
                <Text style={s.rowLabel}>{f.label}</Text>
                <View style={s.barWrap}><Bar pct={(f.value / maxFunnel) * 100} width={120} /></View>
                <Text style={s.rowValue}>{f.value}{f.conversion !== null ? `  (${f.conversion}%)` : ''}</Text>
              </View>
            ))}
            <Text style={{ ...s.kpiLabel, marginTop: 2 }}>Percentages show conversion from the previous step.</Text>
          </View>
          <View style={s.col}>
            <Text style={s.h2}>Acceptance rate by destination</Text>
            {m.acceptance.length === 0 && <Text style={{ color: C.muted }}>No decisions recorded yet.</Text>}
            {m.acceptance.slice(0, 7).map((a) => (
              <View key={a.key} style={s.row}>
                <Text style={s.rowLabel}>{countryName(a.key) || a.key}</Text>
                <View style={s.barWrap}><Bar pct={a.rate} width={110} color={a.decided < 5 ? '#86b6ef' : C.primary} /></View>
                <Text style={s.rowValue}>{a.rate}%  n={a.decided}</Text>
              </View>
            ))}
            {m.acceptance.some((a) => a.decided < 5) && <Text style={{ ...s.kpiLabel, marginTop: 2 }}>Lighter bars: fewer than 5 decisions.</Text>}
          </View>
        </View>

        <View style={{ ...s.cols, marginTop: 14 }}>
          <View style={s.col}>
            <Text style={s.h2}>Open cases by risk</Text>
            {([['High risk', m.risk.high, C.high], ['Medium risk', m.risk.medium, C.med], ['Low risk', m.risk.low, C.low], ['Not scored', m.risk.unscored, C.neutral]] as const).map(([label, n, color]) => (
              <View key={label} style={s.row}>
                <Text style={s.rowLabel}>{label}</Text>
                <View style={s.barWrap}><Bar pct={openTotal ? (n / openTotal) * 100 : 0} width={120} color={color} /></View>
                <Text style={s.rowValue}>{n}</Text>
              </View>
            ))}
          </View>
          <View style={s.col}>
            <Text style={s.h2}>Bottleneck</Text>
            <Text>{m.slowestStage ? `Cases spend the longest in “${m.slowestStage.label}” (average ${m.slowestStage.days} days).` : 'Not enough stage history yet to identify a bottleneck.'}</Text>
          </View>
        </View>

        <Text style={s.foot}>
          Figures reflect the filters above at the time of generation. Visa requirements change often and differ by consulate and nationality: confirm them with the consulate or the official portal before advising applicants. Contains aggregate data only; no personal data.
        </Text>
      </Page>
    </Document>
  );
}
