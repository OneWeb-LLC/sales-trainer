'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { OWEB_LOGIN_URL } from '@/lib/st/constants';
import { createClient } from '@/lib/supabase/client';

export default function SsoPage() {
  const params = useSearchParams();
  const router = useRouter();
  const [message, setMessage] = useState('Completing sign-in from OWeb…');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const launchToken = params.get('launch_token');
    if (!launchToken) {
      setFailed(true);
      setMessage(
        'This link is missing a launch token. Open AI Sales Trainer from the OWeb App Store.'
      );
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const redeemRes = await fetch('/api/oweb/sso', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ launchToken }),
        });
        const redeem = await redeemRes.json();
        if (!redeemRes.ok) {
          throw new Error(redeem.message ?? 'Launch token could not be redeemed.');
        }

        const supabase = createClient();
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: redeem.accessToken,
          refresh_token: redeem.refreshToken,
        });
        if (sessionError) throw sessionError;

        const activation = await fetch('/api/activation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            activationKind: 'sso_launch',
            preferredWorkspaceId: redeem.orgId,
          }),
        });
        const ctx = await activation.json();
        if (!ctx.launchAllowed) {
          throw new Error(ctx.activationErrors?.join(' ') ?? 'Workspace launch access denied.');
        }

        if (!cancelled) router.replace('/dashboard');
      } catch (err) {
        if (cancelled) return;
        setFailed(true);
        setMessage(err instanceof Error ? err.message : 'SSO failed.');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [params, router]);

  return (
    <main className="mx-auto flex min-h-svh max-w-lg flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="text-sm">{message}</p>
      {failed && (
        <Button asChild variant="outline">
          <a href={OWEB_LOGIN_URL}>Try again via OWeb</a>
        </Button>
      )}
    </main>
  );
}
