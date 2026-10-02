'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { OWEB_LOGIN_URL } from '@/lib/st/constants';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    const activation = await fetch('/api/activation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activationKind: 'sign_in' }),
    });
    const ctx = await activation.json();
    if (!ctx.launchAllowed) {
      setError(
        ctx.activationErrors?.join(' ') ?? 'Launch access was not granted for this workspace.'
      );
      setLoading(false);
      return;
    }
    router.replace('/dashboard');
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col justify-center gap-8 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">AI Sales Trainer</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Sign in with your OneID credentials (same email and password as OWeb).
        </p>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Email
          <input
            className="border-input bg-background rounded-md border px-3 py-2"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Password
          <input
            className="border-input bg-background rounded-md border px-3 py-2"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        {error && <p className="text-destructive text-sm">{error}</p>}
        <Button type="submit" disabled={loading}>
          {loading ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>

      <div className="flex flex-col gap-2">
        <Button variant="outline" asChild>
          <a href={OWEB_LOGIN_URL}>Continue with OWeb</a>
        </Button>
        <p className="text-muted-foreground text-center text-xs">
          Need an account?{' '}
          <Link className="underline" href="https://oweb.one/signup?launch=sales_trainer">
            Create OneID on OWeb
          </Link>
        </p>
      </div>
    </main>
  );
}
