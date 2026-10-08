import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function PrivacySettings() {
  return (
    <div className="grid gap-5">
      <Card>
        <CardHeader><CardTitle>How applicant data is protected</CardTitle><CardDescription>Applicant documents are sensitive personal data.</CardDescription></CardHeader>
        <CardContent className="grid gap-2 text-sm">
          <p><strong>Tenant isolation.</strong> Every table is protected by row-level security. A user in another organisation can never read or write your data, and tests prove it.</p>
          <p><strong>Private storage.</strong> Documents live in a private bucket. There are no public URLs; downloads use signed links that expire after two minutes and are only issued to people who may see that case.</p>
          <p><strong>Least privilege.</strong> Advisors see only the applicants assigned to them unless an admin grants more. Viewers are read-only.</p>
          <p><strong>Audit trail.</strong> Stage changes, document verification, role changes and deletions are recorded in an append-only audit log owners and admins can review.</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Data subject requests (GDPR)</CardTitle></CardHeader>
        <CardContent className="grid gap-2 text-sm">
          <p><strong>Access / portability.</strong> Open the applicant’s case, then <em>More actions → Export their data (JSON)</em>. It contains their profile, cases, checklist, tasks, stage history and activity (file contents are not included; download those from the checklist).</p>
          <p><strong>Erasure.</strong> Owners and admins: open the case, then <em>More actions → Erase applicant</em>. This permanently deletes the person, all their cases, uploaded files, tasks, notes and activity. The audit log keeps only that an erasure took place, with no personal data.</p>
          <p><strong>Bulk deletion.</strong> Select applicants in <Link href="/applicants" className="text-primary underline underline-offset-2 hover:no-underline">Applicants</Link> and choose Delete.</p>
          <p className="text-muted-foreground">You are the data controller for your applicants; we act as your processor. Make sure you have a lawful basis, a data processing agreement and an applicant privacy notice before you upload their documents.</p>
        </CardContent>
      </Card>
    </div>
  );
}
