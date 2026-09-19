import type { LocationError } from '@/lib/use-user-location'

// Why the distance shown might not be measured from where the user actually
// is. Every branch names the fallback out loud, which is the whole point:
// nothing may quietly present the city centre as the customer's position.
export function locationMessage(error: LocationError) {
	switch (error) {
		case 'denied':
			return 'Joylashuvga ruxsat berilmadi. Masofa Toshkent markazidan hisoblanmoqda.'
		case 'timeout':
			return 'GPS javob bermadi. Masofa Toshkent markazidan hisoblanmoqda.'
		case 'unavailable':
			return 'Qurilma joylashuvni aniqlay olmadi. Masofa Toshkent markazidan hisoblanmoqda.'
		case 'outside-uzbekistan':
			return 'Joylashuv O‘zbekiston hududidan tashqarida. Masofa Toshkent markazidan hisoblanmoqda.'
		case 'unsupported':
			return 'Bu brauzer geolokatsiyani qo‘llamaydi. Masofa Toshkent markazidan hisoblanmoqda.'
		default:
			return 'GPS hozir mavjud emas. Masofa Toshkent markazidan hisoblanmoqda.'
	}
}

// Loose contains-match used by Home's search overlay: whole-string first,
// then any token over two characters, so "plov center" still finds "Plov
// Center" when only one word is typed.
export function searchMatches(text: string, query: string) {
	const normalized = query.trim().toLowerCase()
	if (!normalized) return false
	const haystack = text.toLowerCase()
	if (haystack.includes(normalized)) return true
	const tokens = normalized.split(/\s+/).filter(token => token.length > 2)
	return tokens.some(token => haystack.includes(token))
}

// The street part of an address: everything before the house number. City
// Goo's search offers a hardcoded list of five Tashkent streets; these are
// derived from the catalogs instead, so the group can never advertise a
// street the app knows nothing about.
export function streetOf(address: string) {
	const [street] = address.split(',')
	return street.trim()
}

export type AddressHit = {
	street: string
	// Where "route to this address" should actually go.
	parkingId: string
	// How many catalog entries sit on this street.
	count: number
}

export function findAddresses(
	query: string,
	entries: { address: string; parkingId?: string | null }[],
): AddressHit[] {
	const byStreet = new Map<string, AddressHit>()

	for (const entry of entries) {
		if (!entry.parkingId) continue
		const street = streetOf(entry.address)
		if (!street || !searchMatches(street, query)) continue

		const existing = byStreet.get(street)
		if (existing) existing.count += 1
		else byStreet.set(street, { street, parkingId: entry.parkingId, count: 1 })
	}

	return [...byStreet.values()].sort((a, b) => b.count - a.count)
}

// Split text around the matched run so the caller can <mark> it — City Goo's
// hl(). Returns [before, match, after]; match is empty when nothing hit.
export function highlightParts(
	text: string,
	query: string,
): [string, string, string] {
	const needle = query.trim().toLowerCase()
	if (!needle) return [text, '', '']

	const at = text.toLowerCase().indexOf(needle)
	if (at >= 0) {
		return [
			text.slice(0, at),
			text.slice(at, at + needle.length),
			text.slice(at + needle.length),
		]
	}

	// Fall back to the longest token that does hit, matching searchMatches()'s
	// own two-pass behaviour — otherwise a two-word query highlights nothing
	// on a row it just matched.
	const tokens = needle
		.split(/\s+/)
		.filter(token => token.length > 2)
		.sort((a, b) => b.length - a.length)

	for (const token of tokens) {
		const index = text.toLowerCase().indexOf(token)
		if (index >= 0) {
			return [
				text.slice(0, index),
				text.slice(index, index + token.length),
				text.slice(index + token.length),
			]
		}
	}

	return [text, '', '']
}
