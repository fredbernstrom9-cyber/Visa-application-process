import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Brand } from '@/components/brand';
import { ThemeToggle } from '@/components/app/theme-toggle';
import { Button } from '@/components/ui/button';

// Separate from the workspace layout: the platform owner does not need to belong to any organisation to see this.
export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-background/85 px-3 backdrop-blur sm:px-6">
        <Brand className="text-sm" />
        <span className="hidden rounded-md bg-neutral-bg px-2 py-0.5 text-xs font-medium text-neutral sm:inline">Platform · read-only</span>
        <div className="ml-auto flex items-center gap-2">
          <Button asChild variant="ghost" size="sm"><Link href="/overview"><ArrowLeft /> Workspace</Link></Button>
          <ThemeToggle />
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-[1300px] px-3 py-5 sm:px-6 sm:py-6">{children}</main>
    </div>
  );
}
