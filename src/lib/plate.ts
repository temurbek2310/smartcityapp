// Uzbek vehicle plate formatting, shared by the registration input and by
// every screen that displays a plate, so a vehicle never renders two
// different ways.
//
// Two civilian layouts are in use, and both are eight characters. Which one
// applies is decided by the third character:
//
//   01 A 777 AA   region(2) + series letter(1) + number(3) + series(2)
//   01 777 AAA    region(2) + number(3) + series(3)
//
// The letter-third form also covers plates whose last group is digits
// (e.g. diplomatic "01 D 123 45"), because grouping is positional and does
// not assert what each group contains.

const MAX_PLATE_CHARS = 8

// Compact, uppercase, punctuation-free form — useful for comparing two
// plates that were typed differently.
export function normalizeUzbekPlate(value: string) {
	return value
		.toUpperCase()
		.replace(/[^A-Z0-9]/g, '')
		.slice(0, MAX_PLATE_CHARS)
}

// Display/entry form. Groups progressively, so it is safe to call on every
// keystroke: "01A7" becomes "01 A 7" rather than waiting for a full plate.
export function formatUzbekPlate(value: string) {
	const raw = normalizeUzbekPlate(value)
	if (raw.length <= 2) return raw

	// A letter in third position means the "01 A 777 AA" layout; a digit
	// means "01 777 AAA".
	const bounds = /[A-Z]/.test(raw[2]) ? [2, 3, 6] : [2, 5]

	const groups: string[] = []
	let start = 0
	for (const bound of bounds) {
		if (raw.length <= bound) break
		groups.push(raw.slice(start, bound))
		start = bound
	}
	groups.push(raw.slice(start))

	return groups.filter(Boolean).join(' ')
}
