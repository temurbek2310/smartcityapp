import { formatUzbekPlate } from "@/lib/plate";
import type { UserProfile } from "@/lib/types";

// localStorage is the one input this app cannot re-ask for.
//
// An older build stored the vehicle under `plate`; the field is `vehiclePlate`
// now, and every profile written before that rename comes back with no plate
// at all. The defensive formatters stopped that from crashing a page, but the
// customer was still looking at «—» beside a plate they had already given us,
// and each new reservation copied the absent value forward.
//
// So the rename is repaired on the way in. Nothing is invented: a profile
// carrying neither field keeps none, and a profile already in the current
// shape is returned untouched.

// What can actually come back out of storage — not a shape anything builds.
type PersistedProfile = Partial<UserProfile> & { plate?: unknown };

function usablePlate(value: unknown) {
  return typeof value === "string" ? formatUzbekPlate(value) : "";
}

export function hydrateUserProfile(user: unknown): UserProfile | null {
  if (!user || typeof user !== "object") return null;
  const raw = user as PersistedProfile;

  // A current-format profile is kept exactly as it is, down to the object
  // identity, so this can never be the thing that changes a working profile.
  if (usablePlate(raw.vehiclePlate)) return raw as UserProfile;

  const legacy = usablePlate(raw.plate);
  if (!legacy) return raw as UserProfile;

  // The legacy key is left in place rather than deleted: nothing else reads
  // it, this branch stops running once vehiclePlate is set, and removing
  // fields from someone's stored blob is not this function's business.
  return { ...raw, vehiclePlate: legacy } as UserProfile;
}
