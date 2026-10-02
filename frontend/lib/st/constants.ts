export const APP_ID = 'sales_trainer' as const;
export const AUTH_STORAGE_KEY = 'ao-supabase-auth';
export const OWEB_LOGIN_URL = 'https://oweb.one/login?launch=sales_trainer';
export const WORKSPACE_COOKIE = 'st_workspace_id';

export const RUBRIC_CATEGORIES = [
  'opening',
  'discovery',
  'qualification',
  'value_presentation',
  'objection_handling',
  'closing',
  'compliance',
] as const;

export type RubricCategory = (typeof RUBRIC_CATEGORIES)[number];
