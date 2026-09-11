'use client'

import {
	CircleParking,
	Heart,
	MapPin,
	Navigation,
	Route,
	Star,
	Ticket,
	Users,
	X,
} from 'lucide-react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import {
	useEffect,
	useMemo,
	useRef,
	useState,
	type PointerEvent as ReactPointerEvent,
	type WheelEvent as ReactWheelEvent,
} from 'react'

import { ParkingBookingSheet } from '@/components/parking/parking-booking-sheet'
import { Toast } from '@/components/ui/toast'
import { useApp } from '@/context/app-context'
import { EmptyState } from '@/components/ui/empty-state'
import { PARKINGS } from '@/data/parkings'
import { PLACES } from '@/data/places'
import { EVENTS } from '@/data/events'
import { QUEUE_ORGS } from '@/data/queue-orgs'
import { usePlaceFavorites } from '@/hooks/use-place-favorites'
import { useToast } from '@/hooks/use-toast'
import { parkingAvailability } from '@/lib/availability'
import { formatDistance, formatUZS } from '@/lib/format'
import type { Place } from '@/lib/types'

type FavoriteTab = 'places' | 'parking' | 'queues' | 'routes' | 'events'

const TABS: { id: FavoriteTab; label: string }[] = [
	{ id: 'places', label: 'Joylar' },
	{ id: 'parking', label: 'Parkinglar' },
	{ id: 'queues', label: 'Navbatlar' },
	{ id: 'routes', label: 'Marshrutlar' },
	{ id: 'events', label: 'Voqealar' },
]

function isTab(value: string | null): value is FavoriteTab {
	return (
		value === 'places' ||
		value === 'parking' ||
		value === 'queues' ||
		value === 'routes' ||
		value === 'events'
	)
}

export default function FavoritesPage() {
	const params = useSearchParams()
	const {
		favorites,
		toggleFavorite,
		favoriteQueueOrgs,
		toggleQueueOrgFavorite,
		favoriteEvents,
		toggleEventFavorite,
		savedRoutes,
		removeRoute,
	} = useApp()
	const requestedTab = params.get('tab')

	const [tab, setTab] = useState<FavoriteTab>(() =>
		isTab(requestedTab) ? requestedTab : 'places',
	)
	const placeFavorites = usePlaceFavorites()
	const placeFavoriteIds = placeFavorites.ids
	const [bookingParkingId, setBookingParkingId] = useState<string | null>(null)
	const toast = useToast<string>()

	useEffect(() => {
		const timer = window.setTimeout(() => {
			try {
				const savedTab = window.localStorage.getItem(
					'citygoo-favorites-active-tab',
				)
				if (isTab(requestedTab)) setTab(requestedTab)
				else if (isTab(savedTab)) setTab(savedTab)
			} catch {
				// The saved tab is a convenience; the default still renders.
			}
		}, 0)

		return () => window.clearTimeout(timer)
	}, [requestedTab])

	const savedPlaces = useMemo(
		() =>
			PLACES.filter(place => placeFavoriteIds.includes(place.id)),
		[placeFavoriteIds],
	)

	const savedParkings = useMemo(
		() => PARKINGS.filter(parking => favorites.includes(parking.id)),
		[favorites],
	)

	const savedQueueOrgs = useMemo(
		() => QUEUE_ORGS.filter(org => favoriteQueueOrgs.includes(org.id)),
		[favoriteQueueOrgs],
	)

	const savedEvents = useMemo(
		() => EVENTS.filter(event => favoriteEvents.includes(event.id)),
		[favoriteEvents],
	)

	const counts: Record<FavoriteTab, number> = {
		places: savedPlaces.length,
		parking: savedParkings.length,
		queues: savedQueueOrgs.length,
		routes: savedRoutes.length,
		events: savedEvents.length,
	}

	function selectTab(next: FavoriteTab) {
		setTab(next)
		try {
			window.localStorage.setItem('citygoo-favorites-active-tab', next)
		} catch {
			// Favorites still work when persistence is unavailable.
		}
	}

	function removePlace(id: string) {
		placeFavorites.remove(id)
	}

	// -mx-5/-mt-6 escapes the layout's padding so the chip rail can scroll
	// edge to edge — the same idiom parking/[id] uses for its hero. This was
	// a nested <main>, which gave the document two landmarks.
	return (
		<div className='-mx-5 -mt-6 min-h-[calc(100dvh-var(--spacing-nav))] bg-canvas pb-28 pt-5 text-slate-950'>
			<div className='mx-auto w-full max-w-md'>
				<header className='px-4'>
					<div className='flex items-start justify-between gap-4'>
						<div className='min-w-0'>
							<h1 className='text-[25px] font-black tracking-[-0.04em]'>
								Sevimlilar
							</h1>
							<p className='mt-2 text-[13px] leading-5 text-ink-3'>
								Saqlangan joylar, parkinglar va marshrutlar
							</p>
						</div>

						<button
							type='button'
							className='grid size-12 shrink-0 place-items-center rounded-[15px] bg-white text-slate-700 shadow-[0_7px_22px_rgba(15,23,42,0.08)] ring-1 ring-line active:scale-[0.97]'
							aria-label='Sevimlilar menyusi'
						>
							<span className='-translate-y-0.5 text-[22px] leading-none'>
								⋮
							</span>
						</button>
					</div>
				</header>

				<div className='mt-4'>
					<FavoriteTabs tab={tab} counts={counts} onSelect={selectTab} />
				</div>

				<div className='px-4 pt-3'>
					{tab === 'places' ? (
						<section className='space-y-3'>
							{savedPlaces.length ? (
								savedPlaces.map(place => (
									<PlaceFavoriteCard
										key={place.id}
										place={place}
										onRemove={() => removePlace(place.id)}
									/>
								))
							) : (
								<EmptyState
									icon={MapPin}
									title='Hozircha bo‘sh'
									text='Joylarni tez topish uchun bosh sahifadagi yurak tugmasi orqali saqlang.'
									href='/home'
									action='Topish'
								/>
							)}
						</section>
					) : null}

					{tab === 'parking' ? (
						<section className='space-y-3'>
							{savedParkings.length ? (
								savedParkings.map(parking => {
									const { percent: freePercent, tone } =
										parkingAvailability(parking)

									return (
										<article
											key={parking.id}
											className='overflow-hidden rounded-[20px] bg-white shadow-card ring-1 ring-line'
										>

											<Link
												href={`/parking/${parking.id}`}
												className='flex min-h-23'
											>
												<div
													className={`flex w-18 shrink-0 flex-col items-center justify-center gap-1.5 bg-linear-to-br ${parking.accent} text-white/60`}
												>
													<CircleParking className='size-6' />
													<p className='text-[10px] font-bold leading-none text-white/75'>
														{parking.totalSpaces} joy
													</p>
												</div>

												<div className='min-w-0 flex-1 px-4 py-3.5'>
													<div className='flex items-start justify-between gap-2.5'>
														<div className='min-w-0 flex-1'>
															<h2 className='line-clamp-2 text-[15px] font-extrabold leading-[19px]'>
																{parking.name}
															</h2>
															<p className='mt-1 truncate text-[11px] leading-4 text-ink-3'>
																{parking.address}
															</p>
														</div>
														<span className='shrink-0 text-[10.5px] leading-[19px] text-ink-3'>
															{parking.city}
														</span>
													</div>

													<div className='mt-3 flex items-baseline justify-between gap-3'>
														<span
															className={`truncate text-[12.5px] font-bold ${tone.text}`}
														>
															Bo‘sh {parking.availableSpaces} /{' '}
															{parking.totalSpaces}
														</span>
														<span className='shrink-0 text-[12.5px] font-extrabold text-slate-950'>
															{formatUZS(parking.pricePerHour)}/s
														</span>
													</div>

													<div className='mt-2.5 h-[7px] overflow-hidden rounded-full bg-line'>
														<span
															className={`block h-full rounded-full transition-[width] duration-400 ${tone.bar}`}
															style={{ width: `${freePercent}%` }}
														/>
													</div>
												</div>
											</Link>

											<div className='flex items-center gap-2 px-4 pb-4'>
												<Link
													href={`/navigate/parking/${parking.id}`}
													className='flex h-[34px] min-w-0 flex-1 items-center justify-center gap-[7px] whitespace-nowrap rounded-[9px] border-[1.5px] border-line-2 bg-white px-2.5 text-[12px] font-bold active:scale-[0.975]'
												>
													<Navigation className='size-3.5 shrink-0' />
													Yo‘nalish
												</Link>
												<button
													type='button'
													onClick={() => setBookingParkingId(parking.id)}
													className='flex h-[34px] min-w-0 flex-[1.15] items-center justify-center whitespace-nowrap rounded-[9px] bg-brand px-2.5 text-[12px] font-extrabold text-white shadow-[0_6px_16px_rgba(108,71,224,.28)] active:scale-[0.975]'
												>
													Bron qilish
												</button>
												<button
													type='button'
													onClick={() => toggleFavorite(parking.id)}
													className='grid size-[34px] shrink-0 place-items-center rounded-[9px] bg-card-2 text-rose-500 active:scale-[0.975]'
													aria-label={`${parking.name}ni sevimlilardan olib tashlash`}
												>
													<X className='size-4' />
												</button>
											</div>
										</article>
									)
								})
							) : (
								<EmptyState
									icon={CircleParking}
									title='Hozircha bo‘sh'
									text='Parkingni bron qiling yoki yurak tugmasini bosing — u shu yerda paydo bo‘ladi.'
									href='/home'
									action='Topish'
								/>
							)}
						</section>
					) : null}

					{tab === 'queues' ? (
						<section className='space-y-3'>
							{savedQueueOrgs.length ? (
								savedQueueOrgs.map(org => (
									<article
										key={org.id}
										className='flex items-center gap-3 rounded-card-lg bg-card p-3 shadow-card'
									>
										<Link
											href='/queues'
											className='flex min-w-0 flex-1 items-center gap-3'
										>
											<span className='grid size-12 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand'>
												<Users className='size-5' />
											</span>
											<span className='min-w-0'>
												<span className='block truncate text-[15px] font-extrabold'>
													{org.title}
												</span>
												<span className='mt-0.5 block truncate text-[11px] text-ink-3'>
													{org.address} · {org.waiting} kishi
												</span>
											</span>
										</Link>
										<span
											className={`shrink-0 rounded-[7px] px-2 py-1 text-[10px] font-extrabold ${
												org.waitMinutes < 15
													? 'bg-ok-bg text-ok'
													: org.waitMinutes < 35
														? 'bg-warn-bg text-warn'
														: 'bg-bad-bg text-bad'
											}`}
										>
											{org.waitMinutes} daq
										</span>
										<button
											type='button'
											aria-label='Olib tashlash'
											onClick={() => toggleQueueOrgFavorite(org.id)}
											className='grid size-9 shrink-0 place-items-center rounded-xl bg-card-2 text-bad'
										>
											<X className='size-4' />
										</button>
									</article>
								))
							) : (
								<EmptyState
									icon={Users}
									title='Hozircha bo‘sh'
									text='Navbat sahifasidagi yurak tugmasi orqali tashkilotlarni saqlang.'
									href='/queues'
									action='Navbatlar'
								/>
							)}
						</section>
					) : null}

					{tab === 'routes' ? (
						<section className='space-y-3'>
							{savedRoutes.length ? (
								savedRoutes.map(route => (
									<article
										key={route.id}
										className='rounded-card-lg bg-card p-3 shadow-card'
									>
										<div className='flex items-start justify-between gap-3'>
											<div className='min-w-0'>
												<h2 className='truncate text-[15px] font-extrabold'>
													{route.title}
												</h2>
												<p className='mt-1 truncate text-[11px] text-ink-3'>
													{route.from} → {route.to}
												</p>
											</div>
											<button
												type='button'
												aria-label='Olib tashlash'
												onClick={() => removeRoute(route.id)}
												className='grid size-9 shrink-0 place-items-center rounded-xl bg-card-2 text-bad'
											>
												<X className='size-4' />
											</button>
										</div>
										<Link
											href={`/transport?mode=${route.mode}${route.parkingId ? `&parkingId=${route.parkingId}` : ''}`}
											className='mt-3 flex h-9 items-center justify-center gap-1.5 rounded-[10px] bg-brand text-[11.5px] font-extrabold text-white'
										>
											<Navigation className='size-3.5' /> Qayta qurish
										</Link>
									</article>
								))
							) : (
								<EmptyState
									icon={Route}
									title='Hozircha bo‘sh'
									text='Transport ekranida marshrut qurib, “Marshrutni saqlash” tugmasini bosing.'
									href='/transport'
									action='Marshrut qurish'
								/>
							)}
						</section>
					) : null}

					{tab === 'events' ? (
						<section className='space-y-3'>
							{savedEvents.length ? (
								savedEvents.map(event => (
									<article
										key={event.id}
										className='overflow-hidden rounded-card-lg bg-card shadow-card'
									>
										<div
											className={`flex h-24 items-end justify-between bg-linear-to-br p-3 ${event.accent}`}
										>
											<span className='rounded-[7px] bg-white/90 px-2 py-1 text-[10px] font-extrabold text-ink'>
												{event.when}, {event.time}
											</span>
											<span className='rounded-[7px] bg-white/90 px-2 py-1 text-[10px] font-extrabold text-ink-2'>
												{event.category}
											</span>
										</div>
										<div className='p-3'>
											<h2 className='text-[15px] font-extrabold'>
												{event.title}
											</h2>
											<p className='mt-1 text-[11px] text-ink-3'>
												{event.place} · {event.price}
											</p>
											<div className='mt-3 grid grid-cols-2 gap-2'>
												<Link
													href={`/parking/${event.parkingId}`}
													className='flex h-9 items-center justify-center gap-1.5 rounded-[10px] border-[1.5px] border-line-2 bg-white text-[11.5px] font-bold'
												>
													<CircleParking className='size-3.5' /> Parking
												</Link>
												<button
													type='button'
													onClick={() => toggleEventFavorite(event.id)}
													className='flex h-9 items-center justify-center gap-1.5 rounded-[10px] bg-card-2 text-[11.5px] font-bold text-bad'
												>
													<X className='size-3.5' /> Olib tashlash
												</button>
											</div>
										</div>
									</article>
								))
							) : (
								<EmptyState
									icon={Ticket}
									title='Hozircha bo‘sh'
									text='Bosh sahifadagi voqealar ro‘yxatidan yurak tugmasi orqali saqlang.'
									href='/home'
									action='Voqealar'
								/>
							)}
						</section>
					) : null}
				</div>
			</div>

			<ParkingBookingSheet
				parkingId={bookingParkingId}
				onClose={() => setBookingParkingId(null)}
				onNotify={toast.show}
			/>

			<Toast open={toast.open} message={toast.payload ?? ''} />
		</div>
	)
}

function FavoriteTabs({
	tab,
	counts,
	onSelect,
}: {
	tab: FavoriteTab
	counts: Record<FavoriteTab, number>
	onSelect: (tab: FavoriteTab) => void
}) {
	const railRef = useRef<HTMLDivElement>(null)
	const pointerIdRef = useRef<number | null>(null)
	const startXRef = useRef(0)
	const startScrollLeftRef = useRef(0)
	const draggingRef = useRef(false)
	const suppressClickUntilRef = useRef(0)

	function handleWheel(event: ReactWheelEvent<HTMLDivElement>) {
		const element = railRef.current
		if (!element || element.scrollWidth <= element.clientWidth) return

		if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
			element.scrollLeft += event.deltaY
			event.preventDefault()
		}
	}

	function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
		if (event.pointerType === 'touch') return
		pointerIdRef.current = event.pointerId
		startXRef.current = event.clientX
		startScrollLeftRef.current = railRef.current?.scrollLeft ?? 0
		draggingRef.current = false
	}

	function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
		const element = railRef.current
		if (!element || pointerIdRef.current !== event.pointerId) return

		const distance = event.clientX - startXRef.current
		if (!draggingRef.current && Math.abs(distance) > 5) {
			draggingRef.current = true
			suppressClickUntilRef.current = performance.now() + 180
			element.setPointerCapture(event.pointerId)
		}

		if (draggingRef.current)
			element.scrollLeft = startScrollLeftRef.current - distance
	}

	function finishPointer(event: ReactPointerEvent<HTMLDivElement>) {
		const element = railRef.current
		if (pointerIdRef.current !== event.pointerId) return

		if (draggingRef.current)
			suppressClickUntilRef.current = performance.now() + 180
		if (element?.hasPointerCapture(event.pointerId))
			element.releasePointerCapture(event.pointerId)

		pointerIdRef.current = null
		draggingRef.current = false
	}

	return (
		<div
			ref={railRef}
			onWheel={handleWheel}
			onPointerDown={handlePointerDown}
			onPointerMove={handlePointerMove}
			onPointerUp={finishPointer}
			onPointerCancel={finishPointer}
			className='w-full overflow-x-auto overflow-y-hidden overscroll-x-contain touch-pan-x select-none cursor-grab active:cursor-grabbing scrollbar-none [&::-webkit-scrollbar]:hidden'
			style={{ WebkitOverflowScrolling: 'touch' }}
		>
			<div className='flex w-max gap-2 px-4 pb-1'>
				{TABS.map(item => (
					<button
						key={item.id}
						type='button'
						onClick={() => {
							if (performance.now() < suppressClickUntilRef.current) return
							onSelect(item.id)
						}}
						className={`h-9 shrink-0 rounded-[11px] px-3.5 text-[12px] font-bold transition active:scale-[0.98] ${
							tab === item.id
								? 'bg-brand text-white shadow-[0_5px_14px_rgba(108,71,224,0.22)]'
								: 'border border-line-2 bg-white text-ink-2'
						}`}
					>
						{item.label} · {counts[item.id]}
					</button>
				))}
			</div>
		</div>
	)
}

function PlaceFavoriteCard({
	place,
	onRemove,
}: {
	place: Place
	onRemove: () => void
}) {
	return (
		<article className='overflow-hidden rounded-[20px] bg-white shadow-[0_4px_14px_rgba(16,24,40,0.07)] ring-1 ring-line'>
			<Link
				href={place.parkingId ? `/parking/${place.parkingId}` : '/home'}
				className='flex min-h-23'
			>
				<div
					className={`grid w-23 shrink-0 place-items-center bg-linear-to-br ${place.accent} text-white/55`}
				>
					<MapPin className='size-5' />
				</div>

				<div className='min-w-0 flex-1 px-3 py-2.5'>
					<div className='flex items-start justify-between gap-2'>
						<div className='min-w-0'>
							<h2 className='truncate text-[15px] font-extrabold'>
								{place.title}
							</h2>
							<p className='mt-1 truncate text-[11px] text-ink-3'>
								{place.subtitle}
							</p>
						</div>
						<span className='shrink-0 text-[10px] text-ink-3'>
							{formatDistance(place.distanceKm)}
						</span>
					</div>

					<div className='mt-2.5 flex items-center gap-2'>
						<span className='flex items-center gap-1 text-[12px] font-bold'>
							<Star className='size-3.5 fill-star text-star' />{' '}
							{place.rating}
						</span>
						<span className='rounded-[7px] bg-ok-bg px-2 py-1 text-[10px] font-extrabold text-ok'>
							Ochiq
						</span>
					</div>
				</div>
			</Link>

			<div className='grid grid-cols-2 gap-2 px-3 pb-3'>
				<Link
					href={
						place.parkingId ? `/navigate/parking/${place.parkingId}` : '/home'
					}
					className='flex h-9 items-center justify-center gap-1.5 rounded-[10px] border border-line-2 bg-white px-2 text-[11px] font-bold'
				>
					<Navigation className='size-3.5' /> Yo‘nalish
				</Link>
				<button
					type='button'
					onClick={onRemove}
					className='flex h-9 items-center justify-center gap-1.5 rounded-[10px] border border-line-2 bg-white px-2 text-[11px] font-bold active:scale-[0.98]'
				>
					<Heart className='size-3.5 text-rose-500' /> Olib tashlash
				</button>
			</div>
		</article>
	)
}

