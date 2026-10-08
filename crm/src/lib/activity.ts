import type { ActivityRow } from './types';
import { stageLabel } from './domain';

export type ActionGroup = 'stage' | 'decisions' | 'documents' | 'tasks' | 'assignment' | 'imports' | 'portal' | 'rules';

export const ACTION_GROUPS: { key: ActionGroup; label: string; types: string[] }[] = [
  { key: 'stage', label: 'Stage moves', types: ['stage_changed', 'case_created'] },
  { key: 'decisions', label: 'Decisions', types: ['decision_recorded'] },
  { key: 'documents', label: 'Documents', types: ['document_status_changed', 'document_uploaded'] },
  { key: 'tasks', label: 'Tasks', types: ['task_created', 'task_completed'] },
  { key: 'assignment', label: 'Assignments', types: ['case_assigned'] },
  { key: 'imports', label: 'Imports & exports', types: ['import_completed', 'export_created', 'report_generated'] },
  { key: 'portal', label: 'Applicant portal', types: ['portal_link_created', 'portal_link_revoked'] },
  { key: 'rules', label: 'Rule changes', types: ['rule_changed'] },
];

export type IconKey = 'plus' | 'stage' | 'gavel' | 'user' | 'file' | 'upload' | 'task' | 'check' | 'import' | 'export' | 'link' | 'rule' | 'dot';

export interface Described {
  icon: IconKey;
  /** Text after the actor's name and before the case link. */
  before: string;
  /** Show the applicant's name as a link after `before`. */
  withCase: boolean;
  /** Text after the case link. */
  after?: string;
}

const s = (v: unknown): string => (typeof v === 'string' ? v : '');

export function describeEvent(e: Pick<ActivityRow, 'type' | 'payload'>, name: (id: string | null | undefined) => string): Described {
  const p = e.payload ?? {};
  switch (e.type) {
    case 'case_created': return { icon: 'plus', before: 'added', withCase: true };
    case 'stage_changed': return { icon: 'stage', before: 'moved', withCase: true, after: `from ${stageLabel(s(p.from))} to ${stageLabel(s(p.to))}` };
    case 'decision_recorded': return { icon: 'gavel', before: 'recorded a decision for', withCase: true, after: `: ${stageLabel(s(p.outcome))}` };
    case 'case_assigned':
      return p.to
        ? { icon: 'user', before: 'assigned', withCase: true, after: `to ${name(s(p.to))}` }
        : { icon: 'user', before: 'unassigned', withCase: true };
    case 'document_status_changed': {
      const to = s(p.to);
      const verb = to === 'verified' ? 'verified' : to === 'needs_redo' ? 'asked for a new copy of' : to === 'received' ? 'marked as received' : 'reset';
      return { icon: 'file', before: `${verb} “${s(p.label)}” for`, withCase: true };
    }
    case 'document_uploaded': return { icon: 'upload', before: `uploaded “${s(p.label)}” for`, withCase: true };
    case 'task_created': return { icon: 'task', before: `created task “${s(p.title)}” on`, withCase: true };
    case 'task_completed': return { icon: 'check', before: `completed task “${s(p.title)}” on`, withCase: true };
    case 'import_completed': return { icon: 'import', before: `imported ${Number(p.created ?? 0)} cases`, withCase: false, after: p.skipped ? `(${Number(p.skipped)} skipped)` : undefined };
    case 'export_created': return { icon: 'export', before: `exported ${Number(p.rows ?? 0)} ${s(p.what) || 'rows'}`, withCase: false };
    case 'report_generated': return { icon: 'export', before: `generated a ${s(p.name) || 'PDF'} report`, withCase: false };
    case 'portal_link_created': return { icon: 'link', before: 'created an applicant portal link for', withCase: true };
    case 'portal_link_revoked': return { icon: 'link', before: 'revoked the portal link for', withCase: true };
    case 'rule_changed': return { icon: 'rule', before: 'flagged a rule change affecting', withCase: true, after: `: ${s(p.summary)}` };
    default: return { icon: 'dot', before: e.type.replace(/_/g, ' '), withCase: true };
  }
}
