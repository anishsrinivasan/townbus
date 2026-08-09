import { createEnv } from "@t3-oss/env-nextjs";

/**
 * v1 has no backend and no secrets — the playlist is a TypeScript file in git
 * and playback goes straight to YouTube — so there is nothing to validate yet.
 * The schema stays here so Phase 2 (listener count Durable Object) has a place
 * to declare its first variable.
 */
export const env = createEnv({
  server: {},
  client: {},
  experimental__runtimeEnv: {},
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
