/**
 * The connection to the auth service, read from the environment.
 *
 * Deliberately **not** `NEXT_PUBLIC_`-prefixed: every Supabase client in this
 * app is built on the server (Server Actions and the middleware), so the
 * prefix would ship the connection to the browser for no reason. The day a
 * browser-side client is genuinely needed, these names change on purpose
 * rather than by having always been public.
 */
export interface SupabaseEnv {
  url: string;
  publishableKey: string;
}

const URL_VAR = "SUPABASE_URL";
const KEY_VAR = "SUPABASE_PUBLISHABLE_KEY";

/**
 * A declared-but-blank variable is the likelier mistake than a missing line,
 * and it fails identically: an empty string reaching the SDK would surface as
 * an opaque request error far from its cause.
 */
function readVar(
  env: Record<string, string | undefined>,
  name: string,
): string {
  const value = env[name];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(
      `Missing ${name}. Set it in .env.local — run \`supabase status\` to get the value.`,
    );
  }
  return value.trim();
}

/**
 * Reads the whole configuration or throws naming the exact variable at fault.
 * Never returns partial config, so no caller can attempt a request against a
 * half-configured connection.
 *
 * `process.env` is the default of the parameter rather than being read inside,
 * so every test passes its own record and none of them mutate the real
 * environment.
 */
export function readSupabaseEnv(
  env: Record<string, string | undefined> = process.env,
): SupabaseEnv {
  // Built field by field, so nothing else in the environment — least of all a
  // service-role key — can ride along in the returned object.
  return {
    url: readVar(env, URL_VAR),
    publishableKey: readVar(env, KEY_VAR),
  };
}
