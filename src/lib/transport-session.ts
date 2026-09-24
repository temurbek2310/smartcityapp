// When /transport starts over.
//
// The screen keeps the address bar on the trip it is showing
// (history.replaceState), and in this Next.js the History API is synced into
// useSearchParams(). The view used to be keyed on the query string itself,
// so every mode, origin or destination change the customer made remounted
// the whole screen — the map was rebuilt and every filter, tab and open sheet
// was lost. A future route request would have been refetched from scratch
// each time too.
//
// So the view is keyed on a session instead. A query the view wrote itself
// is just the view keeping the URL in sync: same session. Any other query —
// a link, a saved route replayed, a back/forward step — is somebody else
// deciding where the screen should be: new session, fresh state from the URL.
//
// React does not apply "the view recorded a write" and "the router saw the
// new URL" in the same render: the router's update is a transition, so there
// is a render in between where the session already knows the new query and
// the address bar still reads the old one. Queries the session has left but
// the router has not caught up with yet are therefore still its own.
export type TransportSession = {
	// The React key of the current mount. Counts sessions as well as naming
	// the query, so returning to a query an earlier session had is still a
	// new mount.
	key: string
	generation: number
	// The query this session last wrote (or was opened with).
	synced: string
	// Queries it wrote before `synced` that the router may still report
	// until it catches up. Emptied as soon as it does.
	inFlight: string[]
}

export function openTransportSession(query: string, generation = 0): TransportSession {
	return { key: `${generation}:${query}`, generation, synced: query, inFlight: [] }
}

// What the session becomes when the address bar reads `query`. Returns the
// same object when nothing changes, so a caller can compare by identity.
export function transportSessionFor(session: TransportSession, query: string): TransportSession {
	if (query === session.synced) {
		return session.inFlight.length === 0 ? session : { ...session, inFlight: [] }
	}
	if (session.inFlight.includes(query)) return session
	return openTransportSession(query, session.generation + 1)
}

// Recorded just before the view writes `query` itself, so reading it back
// from useSearchParams() is recognized as its own.
export function recordTransportSync(session: TransportSession, query: string): TransportSession {
	if (query === session.synced) return session
	return {
		...session,
		synced: query,
		inFlight: [...session.inFlight.filter(item => item !== query), session.synced],
	}
}
