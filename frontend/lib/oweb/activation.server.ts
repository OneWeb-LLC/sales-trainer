import type { SupabaseClient } from '@supabase/supabase-js';
import {
  type ActivationKind,
  activateOneIdApp,
  activateWorkspace,
} from '@/lib/oweb/oweb-api.server';
import { APP_ID } from '@/lib/st/constants';

const PRIVILEGED_ROLES = new Set(['owner', 'admin']);
const SESSION_ACTIVATION_KINDS = new Set([
  'personal_bootstrap',
  'created',
  'sign_in',
  'sso_launch',
  'invite_accept',
  'provisioned',
]);

export type WorkspaceContext = {
  workspaceId: string;
  workspaceName: string;
  workspaceRole: string | null;
  fallbackUsed: boolean;
  isAdmin: boolean;
  launchAllowed: boolean;
  grantStatus: string | null;
  activationErrors: string[];
};

type MemberWorkspace = {
  orgId: string;
  role: string | null;
  name: string;
  kind: string | null;
  createdAt: string;
};

async function loadMemberWorkspaces(
  supabase: SupabaseClient,
  userId: string
): Promise<MemberWorkspace[]> {
  const { data: memberships } = await supabase
    .from('ao_org_members')
    .select('org_id, role, created_at')
    .eq('user_id', userId)
    .is('left_at', null)
    .order('created_at', { ascending: true });

  const rows = memberships ?? [];
  const orgIds = rows.map((m) => m.org_id as string);
  if (!orgIds.length) return [];

  const { data: orgRows } = await supabase
    .from('ao_orgs')
    .select('id, name, kind')
    .in('id', orgIds);

  const orgById = new Map((orgRows ?? []).map((o) => [o.id as string, o]));

  return rows
    .map((m) => {
      const org = orgById.get(m.org_id as string);
      if (!org) return null;
      return {
        orgId: m.org_id as string,
        role: m.role ? String(m.role).toLowerCase() : null,
        name: org.name as string,
        kind: org.kind ? String(org.kind).toLowerCase() : null,
        createdAt: m.created_at as string,
      } satisfies MemberWorkspace;
    })
    .filter((w): w is MemberWorkspace => w !== null);
}

async function loadActivatedWorkspaceIds(
  supabase: SupabaseClient,
  userId: string
): Promise<Set<string>> {
  const activated = new Set<string>();
  const { data: rows } = await supabase
    .from('one_id_workspace_activations')
    .select('workspace_id, activation_kind')
    .eq('user_id', userId);

  for (const row of rows ?? []) {
    const kind = String(row.activation_kind ?? '').toLowerCase();
    if (row.workspace_id && SESSION_ACTIVATION_KINDS.has(kind)) {
      activated.add(row.workspace_id as string);
    }
  }
  return activated;
}

function resolveWorkspace(
  workspaces: MemberWorkspace[],
  activated: Set<string>,
  preferredWorkspaceId?: string | null
): { chosen: MemberWorkspace | null; fallbackUsed: boolean } {
  if (!workspaces.length) return { chosen: null, fallbackUsed: false };

  const requested = preferredWorkspaceId
    ? workspaces.find((w) => w.orgId === preferredWorkspaceId)
    : undefined;

  if (requested && activated.has(requested.orgId)) {
    return { chosen: requested, fallbackUsed: false };
  }

  const activatedPersonal = workspaces.find((w) => w.kind === 'personal' && activated.has(w.orgId));
  if (activatedPersonal) {
    return {
      chosen: activatedPersonal,
      fallbackUsed: Boolean(
        preferredWorkspaceId && preferredWorkspaceId !== activatedPersonal.orgId
      ),
    };
  }

  const activatedAny = workspaces.find((w) => activated.has(w.orgId));
  if (activatedAny) {
    return {
      chosen: activatedAny,
      fallbackUsed: Boolean(preferredWorkspaceId && preferredWorkspaceId !== activatedAny.orgId),
    };
  }

  const personal = workspaces.find((w) => w.kind === 'personal') ?? workspaces[0];
  return {
    chosen: personal,
    fallbackUsed: Boolean(preferredWorkspaceId && preferredWorkspaceId !== personal.orgId),
  };
}

export async function ensureStProfile(
  supabase: SupabaseClient,
  userId: string,
  email?: string | null
) {
  await supabase.from('st_profiles').upsert(
    {
      id: userId,
      display_name: email?.split('@')[0] ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  );
}

export async function resolveSalesTrainerContext(input: {
  supabase: SupabaseClient;
  userId: string;
  accessToken: string;
  preferredWorkspaceId?: string | null;
  activationKind?: ActivationKind;
}): Promise<WorkspaceContext> {
  const { supabase, userId, accessToken, preferredWorkspaceId, activationKind = 'sign_in' } = input;
  const activationErrors: string[] = [];

  const workspaces = await loadMemberWorkspaces(supabase, userId);
  const activated = await loadActivatedWorkspaceIds(supabase, userId);
  const { chosen, fallbackUsed } = resolveWorkspace(workspaces, activated, preferredWorkspaceId);

  const appActivation = await activateOneIdApp(accessToken, activationKind);
  if (!appActivation.ok) activationErrors.push(`App activation: ${appActivation.detail}`);

  if (!chosen) {
    return {
      workspaceId: '',
      workspaceName: '',
      workspaceRole: null,
      fallbackUsed: false,
      isAdmin: false,
      launchAllowed: false,
      grantStatus: null,
      activationErrors: [
        ...activationErrors,
        'No workspace membership found. Join or create a workspace in OWeb first.',
      ],
    };
  }

  const wsActivation = await activateWorkspace(accessToken, chosen.orgId, activationKind);
  if (!wsActivation.ok) activationErrors.push(`Workspace activation: ${wsActivation.detail}`);

  const isAdmin = !!chosen.role && PRIVILEGED_ROLES.has(chosen.role);

  const { data: grantRow } = await supabase
    .from('ao_workspace_app_grants')
    .select('status')
    .eq('org_id', chosen.orgId)
    .eq('user_id', userId)
    .eq('app_id', APP_ID)
    .maybeSingle();

  const grantStatus = grantRow?.status ? String(grantRow.status).toLowerCase() : null;
  const launchAllowed = isAdmin || grantStatus === 'granted';

  if (!launchAllowed && !isAdmin) {
    activationErrors.push(
      grantStatus
        ? `App grant status is "${grantStatus}" — need "granted" for members.`
        : `No ao_workspace_app_grants row for app_id "${APP_ID}".`
    );
  }

  return {
    workspaceId: chosen.orgId,
    workspaceName: chosen.name,
    workspaceRole: chosen.role,
    fallbackUsed,
    isAdmin,
    launchAllowed: launchAllowed && appActivation.ok && wsActivation.ok,
    grantStatus,
    activationErrors,
  };
}
