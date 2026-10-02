import { NextRequest, NextResponse } from 'next/server';
import { SsoRedeemError, redeemEcosystemLaunchToken } from '@/lib/oweb/redeem-launch-token.server';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { launchToken?: string };
    const launchToken = body.launchToken?.trim();
    if (!launchToken) {
      return NextResponse.json(
        { error: 'missing_launch_token', message: 'Missing launch token.' },
        { status: 400 }
      );
    }

    const result = await redeemEcosystemLaunchToken(launchToken);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof SsoRedeemError) {
      return NextResponse.json({ error: err.code, message: err.message }, { status: 400 });
    }
    console.error(err);
    return NextResponse.json(
      { error: 'sso_failed', message: 'SSO redeem failed.' },
      { status: 500 }
    );
  }
}
