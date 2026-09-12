const ACCOUNT_KEYS = new Set([
	'b-space-mvp-v1', 'citygoo-place-favorites', 'citygoo-parking-filters', 'citygoo-map-layers',
])

// Account deletion covers the auxiliary stores as well as AppProvider state.
// Other applications sharing this origin must keep their data.
export function clearAccountStorage(storage: Storage) {
	const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index))
	for (const key of keys) {
		if (key && (ACCOUNT_KEYS.has(key) || key.startsWith('citygoo-parking-meta-'))) {
			storage.removeItem(key)
		}
	}
	// An empty value prevents the first-visit sample favorite from reappearing.
	storage.setItem('citygoo-place-favorites', '[]')
}
