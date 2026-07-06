/**
 * Authorization helpers for user-triggered logic functions.
 *
 * Reality of this platform: HTTP-triggered logic functions are invoked with the
 * *app access token* (front components authenticate their `fetch` with
 * `TWENTY_APP_ACCESS_TOKEN`), NOT the human's session token. So a server-side
 * `currentUser` lookup never resolves the person behind the request — it has no
 * workspace member and returns undefined every time. Server-side identity
 * derivation is therefore not possible here.
 *
 * The only trustworthy per-user identity is the front component's host-provided
 * `useUserId()`, which the caller resolves to a member id and passes in the body.
 * We use that. This makes private-report isolation *advisory* rather than a hard
 * boundary — which matches the existing model anyway, since the app role has
 * `canReadAllObjectRecords`, so any user of the app can already read every record
 * through the app token regardless of the visibility field.
 *
 * Cron/dispatcher runs have no request user; they call `deliver()` directly and
 * are trusted by design (they only ever email the subscribers the owner chose),
 * so they never go through this path.
 */
import { MetadataApiClient } from 'twenty-client-sdk/metadata';

/**
 * Best-effort server-side lookup of the caller's workspace member id. Under the
 * app-token model this resolves to no member and returns undefined; kept only as a
 * fallback for contexts where the client did not supply an identity.
 */
export async function currentMemberId(): Promise<string | undefined> {
  try {
    const res: any = await new MetadataApiClient().query({
      currentUser: { workspaceMember: { id: true } },
    } as any);
    return res?.currentUser?.workspaceMember?.id ?? undefined;
  } catch {
    return undefined;
  }
}

/**
 * Resolve the caller's member id, preferring the front-end-supplied id (the
 * authenticated `useUserId()` identity) and falling back to the server lookup.
 * Returns undefined when neither is available — callers must treat "no id" as
 * "not the owner" (fail closed).
 */
export async function resolveCallerMemberId(bodyMemberId?: string | null): Promise<string | undefined> {
  const fromBody = (bodyMemberId ?? '').trim();
  if (fromBody) return fromBody;
  return currentMemberId();
}
