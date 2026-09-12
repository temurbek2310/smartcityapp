// Where to send someone after they sign in.
//
// AuthGate hands the attempted path to /welcome as ?next=, so a deep link
// survives the login detour. The value arrives from the URL, which means it
// is attacker-controllable: `next=https://evil.example` or the
// protocol-relative `next=//evil.example` would both turn our own login
// screen into an open redirect. Only same-origin absolute paths are allowed
// through, and /welcome itself is refused so a stale link cannot bounce the
// user back into the flow they just finished.
const FALLBACK = '/home'

export function resolveNextPath(raw: string | null | undefined) {
	if (!raw) return FALLBACK

	// Must be an absolute path on this origin.
	if (!raw.startsWith('/')) return FALLBACK

	// "//host" and "/\host" are read as protocol-relative URLs by browsers,
	// and some parsers fold a backslash into "/" — refuse both rather than
	// reason about which parser sees the value next.
	if (raw.startsWith('//') || raw.includes('\\')) return FALLBACK

	// Returning to /welcome would loop straight back here.
	const path = raw.split(/[?#]/)[0]
	if (path === '/welcome' || path.startsWith('/welcome/')) return FALLBACK

	return raw
}
