'use client'

import { useCallback, useEffect, useState } from 'react'

// Saved *places* (City Goo's demo place catalog) — a separate concern from
// B SPACE's real parking favorites, which live in app-context and stay the
// authority for anything backed by real data.
//
// Home and Favorites each used to read and write this key themselves, with
// different seeds (Home showed Coffee Lab pre-saved, Favorites showed an
// empty list) and Home read storage inside a useState initializer, which
// can disagree with the server-rendered markup. One hook now owns it.
const STORAGE_KEY = 'citygoo-place-favorites'
const DEMO_SEED = ['coffee-lab']

export function usePlaceFavorites() {
	const [ids, setIds] = useState<string[]>([])

	// Deferred so the first client render matches the server, then the
	// stored list arrives.
	useEffect(() => {
		const timer = window.setTimeout(() => {
			try {
				const raw = window.localStorage.getItem(STORAGE_KEY)
				if (raw === null) {
					setIds(DEMO_SEED)
					return
				}
				const parsed = JSON.parse(raw)
				setIds(Array.isArray(parsed) ? parsed : [])
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
