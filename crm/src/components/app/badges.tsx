import {
  AlertOctagon, AlertTriangle, BadgeCheck, CalendarCheck, CheckCircle2, CircleDashed, FileDown, FileText,
  Hourglass, RotateCcw, Send, ShieldCheck, Undo2, UserCheck, XCircle, CircleHelp,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ITEM_STATUS_BY_KEY, RISK_BY_KEY, STAGE_BY_KEY, type CaseStage, type ItemStatus, type RiskKey } from '@/lib/domain';
import { countryName, flagEmoji } from '@/lib/countries';
import { cn } from '@/lib/utils';

const stageIcons = {
  admitted: UserCheck, documents: FileText, appointment: CalendarCheck, submitted: Send,
  decision_pending: Hourglass, approved: CheckCircle2, refused: XCircle, withdrawn: Undo2,
} as const;

export function StageBadge({ stage, short, className }: { stage: CaseStage; short?: boolean; className?: string }) {
  const s = STAGE_BY_KEY[stage];
  const Icon = stageIcons[stage];
  return (
    <Badge tone={s.tone} className={className}>
      <Icon aria-hidden /> {short ? s.short : s.label}
    </Badge>
  );
}

const riskIcons = { low: ShieldCheck, medium: AlertTriangle, high: AlertOctagon } as const;

/** Colour + icon + text label, with the reason always available next to the score. */
export function RiskBadge({ level, reason, showReason, className }: { level: RiskKey | null; reason?: string | null; showReason?: boolean; className?: string }) {
  if (!level) {
    return (
      <span className={cn('inline-flex flex-col gap-0.5', className)}>
        <Badge tone="neutral"><CircleHelp aria-hidden /> Unscored</Badge>
        {showReason && reason && <span className="text-xs text-muted-foreground">{reason}</span>}
      </span>
    );
  }
  const r = RISK_BY_KEY[level];
  const Icon = riskIcons[level];
  return (
    <span className={cn('inline-flex flex-col gap-0.5', className)}>
      <Badge tone={r.tone} title={reason ?? undefined}><Icon aria-hidden /> {r.label}</Badge>
      {showReason && reason && <span className="max-w-[26rem] text-xs leading-snug text-muted-foreground">{reason}</span>}
    </span>
  );
}

const itemIcons = { missing: CircleDashed, received: FileDown, verified: BadgeCheck, needs_redo: RotateCcw } as const;
export function ItemStatusBadge({ status }: { status: ItemStatus }) {
  const s = ITEM_STATUS_BY_KEY[status];
  const Icon = itemIcons[status];
  return <Badge tone={s.tone}><Icon aria-hidden /> {s.label}</Badge>;
}

export function Destination({ code, className }: { code: string; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      <span aria-hidden>{flagEmoji(code)}</span>
      <span>{countryName(code)}</span>
    </span>
  );
}
