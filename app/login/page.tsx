import { Suspense } from "react";
import { isEdConnectEnabled } from "@/lib/edconnect";
import { LoginForm } from "./LoginForm";

/**
 * Rendered per request rather than prerendered.
 *
 * This is load-bearing, not a preference. `isEdConnectEnabled()` reads
 * EDCONNECT_* from the environment, and a statically prerendered page evaluates
 * that during `next build` and bakes the answer into the HTML. docker-compose
 * supplies these as runtime `environment:` values, not build args, so the build
 * would always see them unset and the EdCity button would never appear no matter
 * what the running container is configured with. Without this line the feature
 * silently does not exist in production.
 */
export const dynamic = "force-dynamic";

/**
 * A server component so it can ask whether EdConnect is configured.
 *
 * The alternative — a NEXT_PUBLIC_EDCONNECT_ENABLED flag — would be inlined into
 * the client bundle at build time, so switching SSO on would need
 * `docker compose build --no-cache app` rather than a restart, and the flag
 * could drift out of step with the EDCONNECT_* values that actually decide
 * whether the flow works. Reading it here keeps one source of truth.
 *
 * The form stays a client component (uncontrolled inputs, useSearchParams) and
 * needs the Suspense boundary that useSearchParams requires.
 */
export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm ssoEnabled={isEdConnectEnabled()} />
    </Suspense>
  );
}
