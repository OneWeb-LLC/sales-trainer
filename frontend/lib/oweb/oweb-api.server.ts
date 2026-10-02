import { APP_ID } from '@/lib/st/constants';

export type ActivationKind = 'sign_in' | 'sso_launch' | 'signup';

export type ActivationEndpointResult = {
  ok: boolean;
  status: number;
  detail: string;
};

function owebBaseUrl(): string | null {
  const base = process.env.OWEB_API_BASE_URL ?? process.env.NEXT_PUBLIC_OWEB_BASE_URL;
  if (!base) return null;
  return base.replace(/\/$/, '');
}

async function postOWeb(
  path: string,
  bearerToken: string,
  body: Record<string, unknown>
): Promise<ActivationEndpointResult> {
  const base = owebBaseUrl();
  if (!base) {
    return {
      ok: false,
      status: 0,
      detail: 'OWEB_API_BASE_URL is not configured.',
    };
  }

  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${bearerToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  return {
    ok: res.ok,
    status: res.status,
    detail: text.slice(0, 500) || res.statusText,
  };
}

export async function activateOneIdApp(
  bearerToken: string,
  activationKind: ActivationKind
): Promise<ActivationEndpointResult> {
  return postOWeb('/api/v1/oneid/activate', bearerToken, {
    app_id: APP_ID,
    activation_kind: activationKind,
  });
}

export async function activateWorkspace(
  bearerToken: string,
  workspaceId: string,
  activationKind: ActivationKind
): Promise<ActivationEndpointResult> {
  return postOWeb('/api/v1/oneid/activate-workspace', bearerToken, {
    workspace_id: workspaceId,
    activation_kind: activationKind,
  });
}
