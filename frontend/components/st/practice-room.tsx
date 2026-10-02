'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { TokenSource } from 'livekit-client';
import { useSession } from '@livekit/components-react';
import type { AppConfig } from '@/app-config';
import { AgentSessionProvider } from '@/components/agents-ui/agent-session-provider';
import { StartAudioButton } from '@/components/agents-ui/start-audio-button';
import { ViewController } from '@/components/app/view-controller';
import { Button } from '@/components/ui/button';
import { useAgentErrors } from '@/hooks/useAgentErrors';

export function PracticeRoom({
  appConfig,
  sessionId,
  scenarioTitle,
}: {
  appConfig: AppConfig;
  sessionId: string;
  scenarioTitle: string;
}) {
  const [ending, setEnding] = useState(false);
  const [done, setDone] = useState(false);

  const tokenSource = useMemo(
    () =>
      TokenSource.custom(async () => {
        const res = await fetch('/api/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId }),
        });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || 'Failed to get LiveKit token');
        }
        return res.json();
      }),
    [sessionId]
  );

  const lkSession = useSession(
    tokenSource,
    appConfig.agentName ? { agentName: appConfig.agentName } : undefined
  );

  useAgentErrors();

  const endSession = useCallback(async () => {
    setEnding(true);
    try {
      await fetch(`/api/sessions/${sessionId}/complete`, { method: 'POST' });
      setDone(true);
    } finally {
      setEnding(false);
    }
  }, [sessionId]);

  useEffect(() => {
    if (lkSession.isConnected) {
      fetch(`/api/sessions/${sessionId}/live`, { method: 'POST' }).catch(() => undefined);
    }
  }, [lkSession.isConnected, sessionId]);

  if (done) {
    return (
      <div className="mx-auto max-w-lg space-y-4 text-center">
        <h2 className="text-lg font-semibold">Session complete</h2>
        <p className="text-muted-foreground text-sm">Your scorecard is being generated.</p>
        <Button asChild>
          <Link href={`/sessions/${sessionId}`}>View results</Link>
        </Button>
      </div>
    );
  }

  return (
    <AgentSessionProvider session={lkSession}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-lg font-semibold">{scenarioTitle}</h1>
          <Button variant="outline" size="sm" disabled={ending} onClick={endSession}>
            {ending ? 'Ending…' : 'End & score'}
          </Button>
        </div>
        <main className="grid min-h-[60vh] grid-cols-1 place-content-center">
          <ViewController appConfig={appConfig} />
        </main>
        <StartAudioButton label="Enable microphone" />
      </div>
    </AgentSessionProvider>
  );
}
