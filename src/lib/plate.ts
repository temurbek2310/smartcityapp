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

// What a plate can actually arrive as. The declared types say `string`, but
// these functions also read persisted state, and localStorage is not a
// contract: a blob written by an older build — or any profile saved without
// a vehicle — hydrates with no plate at all. Every screen showing a vehicle
// then called .toUpperCase() on undefined and took the whole page down with
// it, which is a crash in place of a missing value.
export type PlateInput = string | null | undefined

// Compact, uppercase, punctuation-free form — useful for comparing two
// plates that were typed differently. A missing plate normalises to the
// empty string: what an absent plate should *say* is a question for the
// screen showing it, not for the formatter.
export function normalizeUzbekPlate(value: PlateInput) {
	if (typeof value !== 'string') return ''
	return value
		.toUpperCase()
		.replace(/[^A-Z0-9]/g, '')
		.slice(0, MAX_PLATE_CHARS)
}

// Display/entry form. Groups progressively, so it is safe to call on every
// keystroke: "01A7" becomes "01 A 7" rather than waiting for a full plate.
export function formatUzbekPlate(value: PlateInput) {
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

// What a read-only row shows. formatUzbekPlate() answers with an empty
// string because the registration field has to stay empty while it is being
// typed into; a row on a receipt or a session card has nothing to put there
// instead, so it says the plate is missing rather than rendering a blank
// that reads as a layout bug.
export const NO_PLATE = '—'

export function displayUzbekPlate(value: PlateInput, fallback = NO_PLATE) {
	return formatUzbekPlate(value) || fallback
}
