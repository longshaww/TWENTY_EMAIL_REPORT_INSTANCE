/**
 * Authorization helpers for user-triggered logic functions.
 *
 * The critical rule: the caller's identity must be derived SERVER-SIDE, never
 * trusted from the request body. HTTP-triggered logic functions run
 * `MetadataApiClient` as the authenticated caller, so `currentUser` resolves the
 * real workspace member behind the request. Passing a `requestingMemberId` in the
 * body (as an earlier version did) let any member spoof another's identity — this
 * helper closes that hole.
 *
 * Cron/dispatcher runs have no request user; they call `deliver()` directly and
 * are trusted by design (they only ever email the subscribers the owner chose),
 * so they never go through this path.
 */
import { MetadataApiClient } from 'twenty-client-sdk/metadata';

/**
 * The authenticated caller's workspace member id, resolved server-side.
 * Returns undefined when there is no request user (e.g. a system/cron context) or
 * the lookup fails — callers must treat "no id" as "not the owner" (fail closed).
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
