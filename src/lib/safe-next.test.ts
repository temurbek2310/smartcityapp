import { describe, expect, it } from 'vitest'

import { resolveNextPath } from './safe-next'

// ?next= arrives from the URL, so it is attacker-controllable. These cases
// are the reason this function exists rather than the value being used raw.
describe('resolveNextPath', () => {
	it('passes through a same-origin path', () => {
		expect(resolveNextPath('/bookings')).toBe('/bookings')
	})

	it('keeps the query, which is what the deep link is usually for', () => {
		expect(resolveNextPath('/favorites?tab=parking')).toBe(
			'/favorites?tab=parking',
		)
	})

	it('keeps a fragment', () => {
		expect(resolveNextPath('/session/abc#qr')).toBe('/session/abc#qr')
	})

	it('falls back when there is nothing to go back to', () => {
		expect(resolveNextPath(null)).toBe('/home')
		expect(resolveNextPath(undefined)).toBe('/home')
		expect(resolveNextPath('')).toBe('/home')
	})

	it('refuses absolute URLs', () => {
		expect(resolveNextPath('https://evil.example')).toBe('/home')
		expect(resolveNextPath('//evil.example')).toBe('/home')
	})

	it('refuses backslashes, which some parsers fold into "/"', () => {
		expect(resolveNextPath('/\\evil.example')).toBe('/home')
		expect(resolveNextPath('/a\\b')).toBe('/home')
	})

	it('refuses /welcome so a stale link cannot loop the login flow', () => {
		expect(resolveNextPath('/welcome')).toBe('/home')
		expect(resolveNextPath('/welcome/step2')).toBe('/home')
		expect(resolveNextPath('/welcome?next=/home')).toBe('/home')
	})

	it('does not treat a path merely starting with "welcome" as the login route', () => {
		expect(resolveNextPath('/welcomex')).toBe('/welcomex')
	})
})
