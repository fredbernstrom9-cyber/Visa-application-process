'use client';

import { useQueryClient } from '@tanstack/react-query';
import { ArrowRight, ChevronDown } from 'lucide-react';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { StageBadge } from '@/components/app/badges';
import { useOrg } from '@/components/app/org-context';
import { useLive } from '@/components/live/realtime-provider';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Field } from '@/components/ui/label';
import { Textarea } from '@/components/ui/input';
import { changeStageAction } from '@/lib/actions/cases';
import { OPEN_STAGES, STAGES, type CaseStage } from '@/lib/domain';
import { cn } from '@/lib/utils';

/** Visual pipeline for one case plus controls to move it (decisions ask for an optional note). */
export function StageControl({ caseId, stage }: { caseId: string; stage: CaseStage }) {
  const { canWrite } = useOrg();
  const qc = useQueryClient();
  const { announce } = useLive();
  const [pending, start] = useTransition();
  const [decision, setDecision] = useState<null | 'approved' | 'refused'>(null);
  const [reason, setReason] = useState('');

  const move = (to: CaseStage, why?: string) => start(async () => {
    const r = await changeStageAction({ caseIds: [caseId], stage: to, reason: why || null });
    if (!r.ok) { toast.error(r.error); return; }
    toast.success(`Moved to ${STAGES.find((s) => s.key === to)?.short}`);
    setDecision(null); setReason('');
    void qc.invalidateQueries();
    announce(['cases', 'case', 'analytics', 'activity', 'pipeline']);
  });
  const request = (to: CaseStage) => (to === 'approved' || to === 'refused' ? setDecision(to) : move(to));

  const idx = OPEN_STAGES.indexOf(stage);
  const next = idx >= 0 && idx < OPEN_STAGES.length - 1 ? OPEN_STAGES[idx + 1] : null;

  return (
    <div className="grid gap-3">
      <ol className="flex flex-wrap items-center gap-1.5" aria-label="Pipeline progress">
        {OPEN_STAGES.map((s, i) => {
          const reached = idx >= 0 ? i <= idx : true;
          const meta = STAGES.find((x) => x.key === s)!;
          return (
            <li key={s} className="flex items-center gap-1.5" aria-current={s === stage ? 'step' : undefined}>
              <button
                type="button" disabled={!canWrite || pending || s === stage} onClick={() => request(s)}
                className={cn('rounded-full border px-2.5 py-1 text-xs font-medium transition-colors disabled:cursor-default',
                  s === stage ? 'border-primary bg-primary text-primary-foreground' : reached ? 'border-primary/40 bg-accent text-accent-foreground hover:bg-primary/15' : 'text-muted-foreground hover:bg-muted')}
              >
                {meta.short}
              </button>
              {i < OPEN_STAGES.length - 1 && <span className="h-px w-3 bg-border" aria-hidden />}
            </li>
          );
        })}
        {idx < 0 && <li className="ml-2"><StageBadge stage={stage} /></li>}
      </ol>
      {canWrite && (
        <div className="flex flex-wrap gap-2">
          {next && <Button size="sm" loading={pending} onClick={() => request(next)}>Move to {STAGES.find((s) => s.key === next)?.short} <ArrowRight /></Button>}
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button size="sm" variant="outline" disabled={pending}>Set stage <ChevronDown /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {STAGES.map((s) => <DropdownMenuItem key={s.key} disabled={s.key === stage} onSelect={() => request(s.key)}>{s.label}</DropdownMenuItem>)}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      <Dialog open={decision !== null} onOpenChange={(o) => !o && setDecision(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Record decision: {decision === 'approved' ? 'Approved' : 'Refused'}</DialogTitle>
            <DialogDescription>The team is notified and the decision date starts counting in your analytics.</DialogDescription>
          </DialogHeader>
          <Field label={decision === 'refused' ? 'Refusal reason (optional)' : 'Note (optional)'} htmlFor="dec-reason">
            <Textarea id="dec-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={1000} placeholder={decision === 'refused' ? 'e.g. insufficient proof of funds' : 'e.g. visa valid until…'} />
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDecision(null)}>Cancel</Button>
            <Button variant={decision === 'refused' ? 'destructive' : 'default'} loading={pending} onClick={() => decision && move(decision, reason)}>Confirm {decision}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
