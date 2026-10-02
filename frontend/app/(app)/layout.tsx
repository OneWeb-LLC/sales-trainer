import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  return (
    <div className="min-h-svh">
      <nav className="border-border flex flex-wrap items-center gap-4 border-b px-4 py-3 text-sm">
        <Link href="/dashboard" className="font-semibold">
          AI Sales Trainer
        </Link>
        <Link href="/scenarios" className="text-muted-foreground hover:text-foreground">
          Scenarios
        </Link>
        <Link href="/sessions" className="text-muted-foreground hover:text-foreground">
          History
        </Link>
        <Link href="/admin/scenarios" className="text-muted-foreground hover:text-foreground">
          Manage scenarios
        </Link>
        <Link href="/admin/performance" className="text-muted-foreground hover:text-foreground">
          Team performance
        </Link>
      </nav>
      <div className="p-4 md:p-6">{children}</div>
    </div>
  );
}
