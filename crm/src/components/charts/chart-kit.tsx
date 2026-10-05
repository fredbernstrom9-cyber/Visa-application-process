'use client';

import { Download, Sheet as SheetIcon, Table2, BarChart3 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Skeleton, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/misc';
import { downloadTable } from '@/lib/export';
import { cn } from '@/lib/utils';

export const SERIES = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)', 'var(--series-4)', 'var(--series-5)', 'var(--series-6)', 'var(--series-7)', 'var(--series-8)'];
export const RISK_COLOR = { low: 'var(--risk-low)', medium: 'var(--risk-medium)', high: 'var(--risk-high)' } as const;

/** Recessive axes: hairline, text in muted ink (never the series colour). */
export const axisProps = {
  tick: { fill: 'var(--muted-foreground)', fontSize: 12 },
  axisLine: { stroke: 'var(--viz-axis)' },
  tickLine: false as const,
};
export const gridProps = { stroke: 'var(--viz-grid)', strokeWidth: 1, vertical: false };

export interface TableData { headers: string[]; rows: (string | number | null)[][] }

/** Card with title, optional legend, a "view as table" switch and CSV / XLSX export of exactly what is plotted. */
export function ChartCard({ title, description, legend, table, exportName, loading, empty, emptyText, children, className, actions }: {
  title: string; description?: string; legend?: { label: string; color: string; shape?: 'dot' | 'line' | 'diamond' | 'triangle' }[];
  table: TableData; exportName: string; loading?: boolean; empty?: boolean; emptyText?: string; children: React.ReactNode; className?: string; actions?: React.ReactNode;
}) {
  const [asTable, setAsTable] = useState(false);
  return (
    <Card className={cn('flex flex-col', className)}>
      <CardHeader className="flex-row items-start justify-between gap-3">
        <div className="min-w-0">
          <CardTitle>{title}</CardTitle>
          {description && <CardDescription className="mt-1">{description}</CardDescription>}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {actions}
          <Button variant="ghost" size="icon-sm" aria-pressed={asTable} aria-label={asTable ? 'Show chart' : 'Show data as table'} title={asTable ? 'Show chart' : 'Show data as table'} onClick={() => setAsTable(!asTable)}>
            {asTable ? <BarChart3 /> : <Table2 />}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={`Export ${title}`} title="Export" disabled={empty || loading}><Download /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => void downloadTable({ filename: exportName, format: 'csv', headers: table.headers, rows: table.rows })}><Download /> CSV</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void downloadTable({ filename: exportName, format: 'xlsx', headers: table.headers, rows: table.rows, sheet: title.slice(0, 30) })}><SheetIcon /> XLSX</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col gap-3 pt-3">
        {legend && legend.length > 1 && !asTable && (
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="Legend">
            {legend.map((l) => (
              <li key={l.label} className="inline-flex items-center gap-1.5">
                <LegendKey color={l.color} shape={l.shape} /> {l.label}
              </li>
            ))}
          </ul>
        )}
        {loading ? <Skeleton className="h-56 w-full" /> : empty ? (
          <p className="flex min-h-40 flex-1 items-center justify-center rounded-lg border border-dashed px-6 text-center text-sm text-muted-foreground">{emptyText ?? 'No data for these filters yet.'}</p>
        ) : asTable ? (
          <div className="max-h-80 overflow-auto rounded-lg border">
            <Table>
              <TableHeader><TableRow>{table.headers.map((h) => <TableHead key={h}>{h}</TableHead>)}</TableRow></TableHeader>
              <TableBody>{table.rows.map((r, i) => <TableRow key={i}>{r.map((c, j) => <TableCell key={j} className="tabular-nums">{c ?? '—'}</TableCell>)}</TableRow>)}</TableBody>
            </Table>
          </div>
        ) : children}
      </CardContent>
    </Card>
  );
}

export function LegendKey({ color, shape = 'dot' }: { color: string; shape?: 'dot' | 'line' | 'diamond' | 'triangle' }) {
  if (shape === 'line') return <span aria-hidden className="inline-block h-0.5 w-4 rounded" style={{ background: color }} />;
  if (shape === 'diamond') return <span aria-hidden className="inline-block size-2.5 rotate-45" style={{ background: color }} />;
  if (shape === 'triangle') return <span aria-hidden className="inline-block" style={{ width: 0, height: 0, borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderBottom: `10px solid ${color}` }} />;
  return <span aria-hidden className="inline-block size-2.5 rounded-full" style={{ background: color }} />;
}

/** Tooltip body shared by every chart. */
export function TooltipBox({ title, rows, hint }: { title?: string; rows: { label: string; value: string; color?: string; shape?: 'dot' | 'line' | 'diamond' | 'triangle' }[]; hint?: string }) {
  return (
    <div className="min-w-40 rounded-lg border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
      {title && <p className="mb-1 font-semibold">{title}</p>}
      <ul className="grid gap-0.5">
        {rows.map((r) => (
          <li key={r.label} className="flex items-center justify-between gap-4">
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">{r.color && <LegendKey color={r.color} shape={r.shape} />}{r.label}</span>
            <span className="font-medium tabular-nums">{r.value}</span>
          </li>
        ))}
      </ul>
      {hint && <p className="mt-1.5 border-t pt-1.5 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

export const pctLabel = (n: number | null | undefined) => (n === null || n === undefined ? '—' : `${Math.round(n * 10) / 10}%`);
export const shortWeek = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
