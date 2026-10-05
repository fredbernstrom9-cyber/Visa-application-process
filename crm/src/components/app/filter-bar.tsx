'use client';

import { CalendarRange, X } from 'lucide-react';
import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { countryName, destinationOptions, flagEmoji } from '@/lib/countries';
import { RISK_LEVELS, STAGES, VISA_TYPES } from '@/lib/domain';
import { countActiveFilters, type CaseFilters, type ListKey } from '@/lib/filters';
import { useFilterOptions, useMembers } from '@/lib/queries/cases';
import { MultiSelect } from './multi-select';

/** The global filter set shared by the grid, the pipeline and the analytics dashboard. */
export function CaseFilterBar({ filters, onChange, hide = [], dates = true, datesLabel = 'Admitted between' }: {
  filters: CaseFilters; onChange: (next: CaseFilters) => void; hide?: ListKey[]; dates?: boolean; datesLabel?: string;
}) {
  const { data: opts } = useFilterOptions();
  const { data: members } = useMembers();
  const set = <K extends ListKey>(key: K, v: string[]) => onChange({ ...filters, [key]: v.length ? v : undefined });

  const destinations = useMemo(() => {
    const present = opts?.destinations ?? [];
    const all = destinationOptions();
    return (present.length ? all.filter((d) => present.includes(d.code)) : all).map((d) => ({ value: d.code, label: `${flagEmoji(d.code)} ${d.name}`.trim() }));
  }, [opts]);

  const shows = (k: ListKey) => !hide.includes(k);
  const active = countActiveFilters(filters);

  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filters">
      {shows('stage') && <MultiSelect label="Stage" value={filters.stage ?? []} onChange={(v) => set('stage', v)} options={STAGES.map((s) => ({ value: s.key, label: s.label }))} />}
      {shows('risk') && <MultiSelect label="Risk" value={filters.risk ?? []} onChange={(v) => set('risk', v)} options={[...RISK_LEVELS.map((r) => ({ value: r.key, label: r.label })), { value: 'none', label: 'Unscored' }]} />}
      {shows('destination') && <MultiSelect label="Destination" value={filters.destination ?? []} onChange={(v) => set('destination', v)} options={destinations} />}
      {shows('nationality') && <MultiSelect label="Nationality" value={filters.nationality ?? []} onChange={(v) => set('nationality', v)} options={(opts?.nationalities ?? []).map((c) => ({ value: c, label: `${flagEmoji(c)} ${countryName(c)}`.trim() }))} />}
      {shows('visa_type') && <MultiSelect label="Visa type" value={filters.visa_type ?? []} onChange={(v) => set('visa_type', v)} options={VISA_TYPES.map((v) => ({ value: v.key, label: v.label }))} />}
      {shows('advisor') && <MultiSelect label="Advisor" value={filters.advisor ?? []} onChange={(v) => set('advisor', v)} options={[{ value: 'unassigned', label: 'Unassigned' }, ...(members ?? []).map((m) => ({ value: m.user_id, label: m.full_name }))]} />}
      {shows('intake') && <MultiSelect label="Intake" value={filters.intake ?? []} onChange={(v) => set('intake', v)} options={(opts?.intakes ?? []).map((i) => ({ value: i, label: i }))} />}
      {shows('tag') && (opts?.tags?.length ?? 0) > 0 && <MultiSelect label="Tag" value={filters.tag ?? []} onChange={(v) => set('tag', v)} options={(opts?.tags ?? []).map((t) => ({ value: t, label: t }))} />}
      {dates && (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className={`font-normal ${filters.opened_from || filters.opened_to ? 'border-primary/50 bg-accent/60' : ''}`}>
              <CalendarRange /> {filters.opened_from || filters.opened_to ? `${filters.opened_from ?? '…'} → ${filters.opened_to ?? '…'}` : 'Dates'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72">
            <p className="mb-2 text-xs font-medium text-muted-foreground">{datesLabel}</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="grid gap-1"><Label htmlFor="of">From</Label><Input id="of" type="date" value={filters.opened_from ?? ''} onChange={(e) => onChange({ ...filters, opened_from: e.target.value || undefined })} /></div>
              <div className="grid gap-1"><Label htmlFor="ot">To</Label><Input id="ot" type="date" value={filters.opened_to ?? ''} onChange={(e) => onChange({ ...filters, opened_to: e.target.value || undefined })} /></div>
            </div>
          </PopoverContent>
        </Popover>
      )}
      {active > 0 && (
        <Button variant="ghost" size="sm" onClick={() => onChange({})}><X /> Clear filters ({active})</Button>
      )}
    </div>
  );
}
