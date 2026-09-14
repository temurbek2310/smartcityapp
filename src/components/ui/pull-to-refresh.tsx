'use client'

import { RefreshCw } from 'lucide-react'
import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useRef,
	useState,
	type ReactNode,
} from 'react'

import { cn } from '@/lib/cn'

// City Goo's pull-to-refresh, with its numbers kept: rubber-band capped at
// 70px, fires past 60, 900ms of spin. Two things differ. City Goo scrolls an
// inner .viewport div, so it listens there; B SPACE scrolls the document, so
// the gesture is gated on window.scrollY. And rather than mutating the
// catalog the way the reference does, a refresh bumps a counter that derived
// data reads — see lib/live-availability.ts. Mutating module state would make
// what renders depend on how many times you had pulled.

type RefreshValue = {
	tick: number
	refreshing: boolean
	refresh: () => void
}

const RefreshContext = createContext<RefreshValue>({
	tick: 0,
	refreshing: false,
	refresh: () => {},
})

export function useRefreshSignal() {
	return useContext(RefreshContext)
}

const MAX_PULL = 70
const TRIGGER = 60
const SPIN_MS = 900

export function PullToRefresh({ children }: { children: ReactNode }) {
	const [tick, setTick] = useState(0)
	const [refreshing, setRefreshing] = useState(false)
	const [pull, setPull] = useState(0)

	const start = useRef<number | null>(null)
	const travelled = useRef(0)
	const timer = useRef<number | null>(null)

	const refresh = useCallback(() => {
		setRefreshing(true)
		setTick(current => current + 1)
		timer.current = window.setTimeout(() => {
			setRefreshing(false)
			setPull(0)
		}, SPIN_MS)
	}, [])

	useEffect(() => () => {
		if (timer.current) window.clearTimeout(timer.current)
	}, [])

	useEffect(() => {
		function onTouchStart(event: TouchEvent) {
			// Only from the very top, and never when the gesture began inside
			// something that owns horizontal or map panning of its own —
			// The map's canvas and the drag-scrolling rails both do.
			if (window.scrollY > 0) return
			// Not every touchstart carries an Element target, and a throw in a
			// listener would silently disarm the gesture rather than fail loudly.
			const target = event.target
			if (
				target instanceof Element &&
				target.closest('.citygo-map-root, [data-no-ptr]')
			)
				return
			start.current = event.touches[0]?.clientY ?? null
		}

		function onTouchMove(event: TouchEvent) {
			if (start.current === null || refreshing) return
			const delta = (event.touches[0]?.clientY ?? 0) - start.current
			// The raw finger travel is what decides whether this fires; `pull`
			// is only how far the spinner is dragged down.
			travelled.current = delta
			setPull(delta <= 0 ? 0 : Math.min(MAX_PULL, delta * 0.55))
		}

		function onTouchEnd() {
			if (start.current === null) return
			const delta = travelled.current
			start.current = null
			travelled.current = 0
			// Read the distance off a ref rather than deciding inside a
			// setPull updater: an updater must be pure, and refresh() is not.
			if (delta >= TRIGGER) refresh()
			else setPull(0)
		}

		window.addEventListener('touchstart', onTouchStart, { passive: true })
		window.addEventListener('touchmove', onTouchMove, { passive: true })
		window.addEventListener('touchend', onTouchEnd, { passive: true })
		window.addEventListener('touchcancel', onTouchEnd, { passive: true })
		return () => {
			window.removeEventListener('touchstart', onTouchStart)
			window.removeEventListener('touchmove', onTouchMove)
			window.removeEventListener('touchend', onTouchEnd)
			window.removeEventListener('touchcancel', onTouchEnd)
		}
	}, [refresh, refreshing])

	const height = refreshing ? 44 : pull

	return (
		<RefreshContext.Provider value={{ tick, refreshing, refresh }}>
			<div
				aria-hidden={!refreshing}
				style={{ height }}
				className='flex items-center justify-center overflow-hidden transition-[height] duration-[220ms]'
			>
				<RefreshCw
					className={cn(
						'size-5 text-brand',
						'citygo-refresh-spinner',
						refreshing && 'is-refreshing',
					)}
					style={{ opacity: height ? 1 : 0 }}
				/>
			</div>
			{children}
		</RefreshContext.Provider>
	)
}
