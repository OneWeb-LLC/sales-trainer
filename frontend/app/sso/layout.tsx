import { Suspense } from 'react';

export default function SsoLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<p className="p-6 text-center text-sm">Loading…</p>}>{children}</Suspense>
  );
}
