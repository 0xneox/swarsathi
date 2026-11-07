/**
 * Which profile the storage layer is currently reading and writing for.
 *
 * Part 5 adds profiles, and most of what a person owns - their favourite phrases, their Home card
 * layout, the emergency wording they edited - belongs to one profile rather than to the device.
 * Rather than thread a profile id through every repository method (which would change four shipped
 * interfaces and every screen that reads them), storage holds the active profile here and each
 * repository scopes its query with it.
 *
 * The value lives in its own module so `preferences.ts`, `communication.ts` and `profiles.ts` can
 * all read it without importing one another.
 *
 * The store is the only writer: `switchProfile` calls `setActiveProfileId` and then reloads. Storage
 * itself never guesses, and defaults to the profile SwarSathi creates on a first run, so a caller
 * that has not switched yet sees exactly the behaviour it saw before Part 5.
 */

/** Id of the profile a fresh install starts with. Written by migration 5 and never renamed. */
export const DEFAULT_PROFILE_ID = 'profile-default';

let activeProfileId = DEFAULT_PROFILE_ID;

/** The profile every profile-scoped read and write applies to. */
export function getActiveProfileId(): string {
  return activeProfileId;
}

/**
 * Points storage at one profile.
 *
 * Passing `null` (or an empty id) falls back to the default profile rather than leaving storage
 * unbound, so a failed profile switch can never strand the application with no data at all.
 */
export function setActiveProfileId(profileId: string | null): void {
  activeProfileId = profileId && profileId.length > 0 ? profileId : DEFAULT_PROFILE_ID;
}
