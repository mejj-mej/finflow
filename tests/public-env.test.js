import test from 'node:test';
import assert from 'node:assert/strict';
import { assertPublicEnvironment } from '../scripts/public-env.mjs';

// Construct clearly synthetic canaries; never use real credentials in tests.
const publicEnv = {
  VITE_SUPABASE_URL: 'https://example.supabase.co',
  VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_' + 'test'.repeat(8),
};
test('public configuration and placeholder-only setup are accepted', () => {
  assert.doesNotThrow(() => assertPublicEnvironment(publicEnv));
  assert.doesNotThrow(() => assertPublicEnvironment({}));
  assert.doesNotThrow(() => assertPublicEnvironment({ VITE_SUPABASE_URL: 'YOUR_SUPABASE_PROJECT_URL', VITE_SUPABASE_PUBLISHABLE_KEY: 'YOUR_PUBLISHABLE_KEY' }));
});
test('private keys and legacy JWT-shaped values cannot enter the Vite public-key slot', () => {
  for (const prefix of ['sb_' + 'secret_', 'sk' + '-proj-', 'eyJ' + 'canary.canary.']) {
    const value = prefix + 'test'.repeat(8);
    assert.throws(() => assertPublicEnvironment({ ...publicEnv, VITE_SUPABASE_PUBLISHABLE_KEY: value }), error => !error.message.includes(value));
  }
});
test('unapproved VITE variables are rejected without printing their values', () => {
  const value = 'synthetic-test-only-value';
  assert.throws(() => assertPublicEnvironment({ ...publicEnv, VITE_AI_API_KEY: value }), error => error.message.includes('VITE_AI_API_KEY') && !error.message.includes(value));
});
test('credential-bearing URLs and partial configuration are rejected', () => {
  for (const value of ['http://example.supabase.co', 'https://user:pass@example.supabase.co', 'https://example.supabase.co?token=canary', 'https://example.supabase.co#canary', 'not-a-url']) {
    assert.throws(() => assertPublicEnvironment({ ...publicEnv, VITE_SUPABASE_URL: value }), error => !error.message.includes(value));
  }
  assert.throws(() => assertPublicEnvironment({ VITE_SUPABASE_URL: publicEnv.VITE_SUPABASE_URL }));
});
