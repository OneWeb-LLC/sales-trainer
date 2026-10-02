import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'supabase');

describe('st_* migration security invariants', () => {
  const migration = readFileSync(join(root, 'migrations/0003_st_sales_trainer_security_fix.sql'), 'utf8');
  const base = readFileSync(join(root, 'migrations/0002_st_sales_trainer.sql'), 'utf8');

  it('revokes helper execute from anon', () => {
    expect(migration).toMatch(/revoke execute on function public\.st_is_workspace_member\(uuid\) from anon/i);
    expect(migration).toMatch(/revoke execute on function public\.st_is_workspace_admin\(uuid\) from anon/i);
  });

  it('splits session update policies and drops st_sessions_update_self', () => {
    expect(migration).toMatch(/drop policy if exists st_sessions_update_self/i);
    expect(migration).toMatch(/st_sessions_update_rep/i);
    expect(migration).toMatch(/st_sessions_update_admin/i);
    expect(base).not.toMatch(/st_sessions_update_self/i);
  });

  it('guards session identity columns for non-admins', () => {
    expect(migration).toMatch(/st_sessions_guard_identity_columns/i);
    expect(migration).toMatch(/user_id is distinct from old\.user_id/i);
    expect(migration).toMatch(/workspace_id is distinct from old\.workspace_id/i);
    expect(migration).toMatch(/scenario_id is distinct from old\.scenario_id/i);
  });

  it('removes st_profiles.is_manager', () => {
    expect(migration).toMatch(/drop column if exists is_manager/i);
    expect(base).not.toMatch(/is_manager/);
  });
});
