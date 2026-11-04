// Vite embeds VITE_* values in browser assets. Validate before dev/build starts.
const allowed = new Set(['VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY']);
const placeholder = value => !value || value.startsWith('YOUR_');

export function assertPublicEnvironment(env) {
  for (const name of Object.keys(env)) {
    if (name.startsWith('VITE_') && !allowed.has(name)) {
      throw new Error(`Unapproved browser environment variable: ${name}. Keep private credentials in backend secrets.`);
    }
  }
  const url = env.VITE_SUPABASE_URL;
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!placeholder(key) && !/^sb_publishable_[A-Za-z0-9_-]{20,}$/.test(key)) {
    throw new Error('VITE_SUPABASE_PUBLISHABLE_KEY must be a publishable key. Secret keys, provider keys and legacy JWTs are not allowed.');
  }
  if (!placeholder(url)) {
    let parsed;
    try { parsed = new URL(url); } catch { throw new Error('VITE_SUPABASE_URL must be a valid HTTPS project URL.'); }
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.search || parsed.hash) {
      throw new Error('VITE_SUPABASE_URL must be an HTTPS project URL without credentials, query parameters or fragments.');
    }
  }
  if (placeholder(url) !== placeholder(key)) {
    throw new Error('Configure both public Supabase variables, or leave both as placeholders.');
  }
}
