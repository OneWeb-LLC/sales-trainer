import { createHash } from 'node:crypto';
import { APP_ID } from '@/lib/st/constants';
import { createAdminClient } from '@/lib/supabase/admin';

export type RedeemLaunchTokenResult = {
  accessToken: string;
  refreshToken: string;
  orgId: string;
  userId: string;
};

export class SsoRedeemError extends Error {
  constructor(
    message: string,
    readonly code:
      | 'misconfigured'
      | 'missing'
      | 'invalid'
      | 'consumed'
      | 'expired'
      | 'wrong_app'
      | 'no_session'
  ) {
    super(message);
    this.name = 'SsoRedeemError';
  }
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function redeemEcosystemLaunchToken(
  launchToken: string
): Promise<RedeemLaunchTokenResult> {
  const trimmed = launchToken.trim();
  if (!trimmed) throw new SsoRedeemError('Missing launch token.', 'missing');

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    throw new SsoRedeemError(
      'SSO is not configured on this deployment (missing SUPABASE_SERVICE_ROLE_KEY).',
      'misconfigured'
    );
  }

  const tokenHash = hashToken(trimmed);
  const now = new Date().toISOString();

  const { data: row, error } = await admin
    .from('ao_ecosystem_launch_tokens')
    .select('id, app_id, org_id, user_id, access_token, refresh_token, expires_at, consumed_at')
    .eq('token_hash', tokenHash)
    .maybeSingle();

  if (error) throw new SsoRedeemError('Could not verify launch token.', 'invalid');
  if (!row) throw new SsoRedeemError('This launch link is not valid.', 'invalid');
  if (row.consumed_at) throw new SsoRedeemError('This launch link was already used.', 'consumed');
  if (row.expires_at <= now)
    throw new SsoRedeemError('This launch link expired. Relaunch from OWeb.', 'expired');
  if (row.app_id !== APP_ID) {
    throw new SsoRedeemError('This launch link was issued for a different app.', 'wrong_app');
  }

  const { data: consumed, error: consumeError } = await admin
    .from('ao_ecosystem_launch_tokens')
    .update({ consumed_at: now })
    .eq('id', row.id)
    .is('consumed_at', null)
    .select('id')
    .maybeSingle();

  if (consumeError || !consumed) {
    throw new SsoRedeemError('This launch link was already used.', 'consumed');
  }

  if (!row.access_token || !row.refresh_token) {
    throw new SsoRedeemError(
      'Launch token has no session. Open AI Sales Trainer from OWeb again.',
      'no_session'
    );
  }

  return {
    accessToken: row.access_token,
    refreshToken: row.refresh_token,
    orgId: row.org_id,
    userId: row.user_id,
  };
}
