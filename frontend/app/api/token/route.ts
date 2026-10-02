import { NextRequest, NextResponse } from 'next/server';
import { AccessToken, type AccessTokenOptions, type VideoGrant } from 'livekit-server-sdk';
import { RoomAgentDispatch, RoomConfiguration } from '@livekit/protocol';
import { type CookieOptions, createServerClient } from '@supabase/ssr';
import { AUTH_STORAGE_KEY } from '@/lib/st/constants';

type ConnectionDetails = {
  serverUrl: string;
  roomName: string;
  participantName: string;
  participantToken: string;
};

const API_KEY = process.env.LIVEKIT_API_KEY;
const API_SECRET = process.env.LIVEKIT_API_SECRET;
const LIVEKIT_URL = process.env.LIVEKIT_URL;
const AGENT_NAME = process.env.AGENT_NAME ?? 'sales-trainer-agent';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const revalidate = 0;

export async function POST(req: NextRequest) {
  try {
    if (LIVEKIT_URL === undefined) throw new Error('LIVEKIT_URL is not defined');
    if (API_KEY === undefined) throw new Error('LIVEKIT_API_KEY is not defined');
    if (API_SECRET === undefined) throw new Error('LIVEKIT_API_SECRET is not defined');
    if (SUPABASE_URL === undefined) throw new Error('NEXT_PUBLIC_SUPABASE_URL is not defined');
    if (SUPABASE_PUBLISHABLE_KEY === undefined) {
      throw new Error('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is not defined');
    }

    const body = (await req.json().catch(() => ({}))) as { sessionId?: string };
    if (!body.sessionId) {
      return new NextResponse('sessionId is required', { status: 400 });
    }

    const refreshedCookies: { name: string; value: string; options: CookieOptions }[] = [];
    const supabase = createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      cookieOptions: { name: AUTH_STORAGE_KEY },
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          refreshedCookies.push(...cookiesToSet);
        },
      },
    });

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return new NextResponse('Unauthorized: no valid Supabase session', { status: 401 });
    }

    const { data: session, error: sessionErr } = await supabase
      .from('st_sessions')
      .select('id, user_id, scenario_id, workspace_id, language')
      .eq('id', body.sessionId)
      .maybeSingle();

    if (sessionErr || !session || session.user_id !== user.id) {
      return new NextResponse('Forbidden: invalid session', { status: 403 });
    }

    const roomName = `st_${session.id.replace(/-/g, '').slice(0, 20)}_${Math.floor(Math.random() * 9999)}`;

    const metadata = JSON.stringify({
      user_id: user.id,
      session_id: session.id,
      scenario_id: session.scenario_id,
      workspace_id: session.workspace_id,
      language: session.language,
    });

    const roomConfig = new RoomConfiguration({
      agents: [new RoomAgentDispatch({ agentName: AGENT_NAME, metadata })],
    });

    await supabase
      .from('st_sessions')
      .update({ room_name: roomName, status: 'live' })
      .eq('id', session.id);

    const participantIdentity = `rep_${user.id.slice(0, 8)}`;
    const participantToken = await createParticipantToken(
      { identity: participantIdentity, name: 'rep' },
      roomName,
      roomConfig
    );

    const data: ConnectionDetails = {
      serverUrl: LIVEKIT_URL,
      roomName,
      participantName: 'rep',
      participantToken,
    };
    const res = NextResponse.json(data);
    res.headers.set('Cache-Control', 'no-store');
    refreshedCookies.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
    return res;
  } catch (error) {
    if (error instanceof Error) {
      console.error(error);
      return new NextResponse(error.message, { status: 500 });
    }
    return new NextResponse('Unknown error', { status: 500 });
  }
}

function createParticipantToken(
  userInfo: AccessTokenOptions,
  roomName: string,
  roomConfig: RoomConfiguration | undefined
): Promise<string> {
  const at = new AccessToken(API_KEY, API_SECRET, {
    ...userInfo,
    ttl: '15m',
  });
  const grant: VideoGrant = {
    room: roomName,
    roomJoin: true,
    canPublish: true,
    canPublishData: true,
    canSubscribe: true,
  };
  at.addGrant(grant);
  if (roomConfig) at.roomConfig = roomConfig;
  return at.toJwt();
}
