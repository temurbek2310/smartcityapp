// Who owns each localStorage key this app writes, written down once.
//
// User-owned: something this customer did. Logout removes it, because there is
// no account id to file it under and the next person to sign in on this device
// would otherwise inherit it.
//
// Device preferences: how this device is set up to look. Logout keeps them;
// only a full demo reset (a fresh install) removes them.
//
// Not listed on purpose: `smartcity-install-dismissed` lives in sessionStorage
// and belongs to the browser session, not to anyone's account.

// AppProvider's own blob. Logout does not remove it — the store rewrites it
// with the signed-out state, which is how onboardingDone survives.
export const MAIN_STATE_KEY = 'smartcity-mvp-v1'

const USER_OWNED_KEYS = new Set(['citygoo-place-favorites'])
// One key per parking reservation (booking-meta.ts). Removed by prefix, not
// by the current reservation ids: finished bookings leave theirs behind.
const USER_OWNED_PREFIX = 'citygoo-parking-meta-'

// What a fresh install additionally does not have. The Favorites tab
// selection is a device preference too, but reset has never cleared it and
// is not redesigned here.
const RESET_DEVICE_KEYS = new Set(['citygoo-parking-filters', 'citygoo-map-layers'])

function isUserOwnedSideKey(key: string) {
	return USER_OWNED_KEYS.has(key) || key.startsWith(USER_OWNED_PREFIX)
}

// Keys are collected first: removing while indexing would skip entries.
// Other applications sharing this origin keep their data.
function removeKeys(storage: Storage, shouldRemove: (key: string) => boolean) {
	const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index))
	for (const key of keys) {
		if (key && shouldRemove(key)) storage.removeItem(key)
	}
}

// Logout: the side stores that hold this customer's activity. Parking
// filters, map layers and the Favorites tab stay with the device.
export function clearUserOwnedStorage(storage: Storage) {
	removeKeys(storage, isUserOwnedSideKey)
}

// Account deletion and demo reset: back to a fresh install — the main blob,
// every user-owned side store and the device preferences a fresh install
// would not have.
export function clearAccountStorage(storage: Storage) {
	removeKeys(
		storage,
		key => key === MAIN_STATE_KEY || RESET_DEVICE_KEYS.has(key) || isUserOwnedSideKey(key),
	)
	// Nothing is written back. There is no first-visit sample favorite left to
	// suppress, and leaving a key behind would mean a deleted account still
	// had a trace in storage.
}
