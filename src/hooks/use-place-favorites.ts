'use client'

import { PLACES } from '@/data/places'
import { useCallback, useEffect, useState } from 'react'

// Saved *places* (City Goo's demo place catalog) — a separate concern from
// B SPACE's real parking favorites, which live in app-context and stay the
// authority for anything backed by real data.
//
// Home and Favorites each used to read and write this key themselves, with
// different seeds (Home showed Coffee Lab pre-saved, Favorites showed an
// empty list) and Home read storage inside a useState initializer, which
// can disagree with the server-rendered markup. One hook now owns it, and
// it seeds nothing: a customer who has saved nothing has saved nothing.
const STORAGE_KEY = 'citygoo-place-favorites'

// Home wrote the cinema as 'cinema-magic', Favorites looked for
// 'magic-cinema'. 'cinema-magic' is what is actually sitting in users'
// storage, so that is the id that survives.
const RENAMED: Record<string, string> = { 'magic-cinema': 'cinema-magic' }

// A saved id that no longer names a place can never be seen or removed
// through the UI, so drop it on read rather than letting it accumulate.
function reconcile(ids: unknown): string[] {
	if (!Array.isArray(ids)) return []
	const known = new Set(PLACES.map(place => place.id))
	const out: string[] = []
	for (const id of ids) {
		if (typeof id !== 'string') continue
		const canonical = RENAMED[id] ?? id
		if (known.has(canonical) && !out.includes(canonical)) out.push(canonical)
	}
	return out
}

export function usePlaceFavorites() {
	const [ids, setIds] = useState<string[]>([])

	// Deferred so the first client render matches the server, then the
	// stored list arrives.
	useEffect(() => {
		const timer = window.setTimeout(() => {
			try {
				const raw = window.localStorage.getItem(STORAGE_KEY)
				// Nothing stored means nothing saved. reconcile() would return the
				// same empty list, but writing it back would create the key on a
				// first visit for no reason.
				if (raw === null) return
				const reconciled = reconcile(JSON.parse(raw))
				setIds(reconciled)
				// Write the cleaned list back so the migration runs once.
				window.localStorage.setItem(STORAGE_KEY, JSON.stringify(reconciled))
			} catch {
				setIds([])
			}
		}, 0)

		return () => window.clearTimeout(timer)
	}, [])

	const persist = useCallback((next: string[]) => {
		setIds(next)
		try {
			window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
		} catch {
			// The UI still works if localStorage is unavailable.
		}
	}, [])

	const has = useCallback((id: string) => ids.includes(id), [ids])

	const toggle = useCallback(
		(id: string) => {
			persist(ids.includes(id) ? ids.filter(item => item !== id) : [...ids, id])
		},
		[ids, persist],
	)

	const remove = useCallback(
		(id: string) => {
			persist(ids.filter(item => item !== id))
		},
		[ids, persist],
	)

	return { ids, has, toggle, remove }
}
