'use client'

import {
	ChevronRight,
	CircleParking,
	Heart,
	MapPin,
	Navigation,
	Route,
	Star,
	Ticket,
	Users,
	X,
	type LucideIcon,
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

import { useApp } from '@/context/app-context'
import { PARKINGS } from '@/data/parkings'

type FavoriteTab = 'places' | 'parking' | 'queues' | 'routes' | 'events'

type SavedPlace = {
	id: string
	title: string
	subtitle: string
	rating: number
	distance: string
	accent: string
	parkingId?: string
}

const SAVED_PLACE_CATALOG: SavedPlace[] = [
	{
		id: 'coffee-lab',
		title: 'Coffee Lab',
		subtitle: 'Kafe · Yevropa oshxonasi',
		rating: 4.8,
		distance: '300 m',
		accent: 'from-[#493329] to-[#151922]',
		parkingId: 'amir-temur',
	},
	{
		id: 'urban-food',
		title: 'Urban Food',
		subtitle: 'Restoran · Osiyo oshxonasi',
		rating: 4.4,
		distance: '270 m',
		accent: 'from-[#74402d] to-[#151922]',
		parkingId: 'amir-temur',
	},
	{
		id: 'plov-center',
		title: 'Plov Center',
		subtitle: 'Milliy oshxona',
		rating: 4.9,
		distance: '480 m',
		accent: 'from-[#4a4020] to-[#151922]',
		parkingId: 'amir-temur',
	},
	{
		id: 'tashkent-city-bc',
		title: 'Tashkent City BC',
		subtitle: 'A+ klass biznes markaz',
		rating: 4.8,
		distance: '1.2 km',
		accent: 'from-[#2c3e63] to-[#151922]',
		parkingId: 'tashkent-city',
	},
	{
		id: 'magic-cinema',
		title: 'Magic Cinema',
		subtitle: 'Kinoteatr · 8 zal',
		rating: 4.6,
		distance: '1.2 km',
		accent: 'from-[#64177d] to-[#151922]',
		parkingId: 'magic-city',
	},
]

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
	const { favorites, toggleFavorite } = useApp()
	const requestedTab = params.get('tab')
	const bookedParkingId = params.get('booked')

	const [tab, setTab] = useState<FavoriteTab>(() =>
		isTab(requestedTab) ? requestedTab : 'places',
	)
	const [placeFavoriteIds, setPlaceFavoriteIds] = useState<string[]>([])
	const [successVisible, setSuccessVisible] = useState(Boolean(bookedParkingId))

	useEffect(() => {
		const timer = window.setTimeout(() => {
			try {
				const savedTab = window.localStorage.getItem(
					'citygoo-favorites-active-tab',
				)
				if (isTab(requestedTab)) setTab(requestedTab)
				else if (isTab(savedTab)) setTab(savedTab)

				const rawPlaces = window.localStorage.getItem('citygoo-place-favorites')
				const parsed = rawPlaces ? JSON.parse(rawPlaces) : []
				setPlaceFavoriteIds(Array.isArray(parsed) ? parsed : [])
			} catch {
				setPlaceFavoriteIds([])
			}
		}, 0)

		return () => window.clearTimeout(timer)
	}, [requestedTab])

	useEffect(() => {
		if (!successVisible) return
		const timer = window.setTimeout(() => setSuccessVisible(false), 3200)
		return () => window.clearTimeout(timer)
	}, [successVisible])

	const savedPlaces = useMemo(
		() =>
			SAVED_PLACE_CATALOG.filter(place => placeFavoriteIds.includes(place.id)),
		[placeFavoriteIds],
	)

	const savedParkings = useMemo(
		() => PARKINGS.filter(parking => favorites.includes(parking.id)),
		[favorites],
	)

	const counts: Record<FavoriteTab, number> = {
		places: savedPlaces.length,
		parking: savedParkings.length,
		queues: 0,
		routes: 0,
		events: 0,
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
		const next = placeFavoriteIds.filter(item => item !== id)
		setPlaceFavoriteIds(next)
		try {
			window.localStorage.setItem(
				'citygoo-place-favorites',
				JSON.stringify(next),
			)
		} catch {
			// Favorites still work when persistence is unavailable.
		}
	}

	return (
		<main className='min-h-[calc(100dvh-76px)] bg-[#f3f4f8] pb-28 pt-5 text-slate-950'>
			<div className='mx-auto w-full max-w-md'>
				<header className='px-4'>
					<div className='flex items-start justify-between gap-4'>
						<div className='min-w-0'>
							<h1 className='text-[25px] font-black tracking-[-0.04em]'>
								Sevimlilar
							</h1>
							<p className='mt-2 text-[13px] leading-5 text-[#8a91a6]'>
								Saqlangan joylar, parkinglar va marshrutlar
							</p>
						</div>

						<button
							type='button'
							className='grid size-12 shrink-0 place-items-center rounded-[15px] bg-white text-slate-700 shadow-[0_7px_22px_rgba(15,23,42,0.08)] ring-1 ring-[#eaecf2] active:scale-[0.97]'
							aria-label='Sevimlilar menyusi'
						>
							<span className='-translate-y-0.5 text-[22px] leading-none'>
								⋮
							</span>
						</button>
					</div>

					{successVisible && bookedParkingId ? (
						<div className='mt-4 flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 shadow-sm'>
							<span className='grid size-9 shrink-0 place-items-center rounded-[11px] bg-emerald-500 text-white'>
								<CircleParking className='size-5' />
							</span>
							<div className='min-w-0 flex-1'>
								<p className='text-[13px] font-extrabold text-emerald-900'>
									Parking muvaffaqiyatli bron qilindi
								</p>
								<p className='mt-0.5 truncate text-[11px] text-emerald-700'>
									Bron qilingan parking Sevimlilarga ham qo‘shildi.
								</p>
							</div>
							<button
								type='button'
								onClick={() => setSuccessVisible(false)}
								className='grid size-8 place-items-center text-emerald-700'
								aria-label='Yopish'
							>
								<X className='size-4' />
							</button>
						</div>
					) : null}
				</header>

				<div className='mt-3'>
					<FavoriteTabs tab={tab} counts={counts} onSelect={selectTab} />
				</div>

				<div className='px-4 pt-2'>
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
									const justBooked = bookedParkingId === parking.id
									const freePercent = Math.max(
										0,
										Math.min(
											100,
											Math.round(
												(parking.availableSpaces / parking.totalSpaces) * 100,
											),
										),
									)

									return (
										<article
											key={parking.id}
											className={`overflow-hidden rounded-[20px] bg-white shadow-[0_4px_14px_rgba(16,24,40,0.07)] ring-1 ${justBooked ? 'ring-violet-300' : 'ring-[#eaecf2]'}`}
										>
											{justBooked ? (
												<div className='bg-[#6c47e0] px-3.5 py-2 text-[11px] font-extrabold text-white'>
													Hozirgina bron qilindi
												</div>
											) : null}

											<Link
												href={`/parking/${parking.id}`}
												className='flex min-h-24'
											>
												<div
													className={`grid w-23 shrink-0 place-items-center bg-linear-to-br ${parking.accent} text-white/60`}
												>
													<div className='text-center'>
														<CircleParking className='mx-auto size-6' />
														<p className='mt-1.5 text-[10px] font-bold text-white/75'>
															{parking.totalSpaces} joy
														</p>
													</div>
												</div>

												<div className='min-w-0 flex-1 px-3.5 py-3'>
													<div className='flex items-start justify-between gap-2'>
														<div className='min-w-0'>
															<h2 className='truncate text-[15px] font-extrabold'>
																{parking.name}
															</h2>
															<p className='mt-1 truncate text-[11px] text-[#8a91a6]'>
																{parking.address}
															</p>
														</div>
														<span className='shrink-0 text-[10px] text-[#8a91a6]'>
															{parking.city}
														</span>
													</div>

													<div className='mt-2.5 flex items-center justify-between gap-3'>
														<span
															className={`truncate text-[12px] font-bold ${freePercent >= 30 ? 'text-emerald-600' : freePercent >= 15 ? 'text-amber-600' : 'text-rose-500'}`}
														>
															Bo‘sh {parking.availableSpaces} /{' '}
															{parking.totalSpaces}
														</span>
														<span className='shrink-0 text-[12px] font-extrabold'>
															{parking.pricePerHour.toLocaleString('ru-RU')}{' '}
															so‘m/s
														</span>
													</div>

													<div className='mt-2 h-1.25 overflow-hidden rounded-full bg-[#eaecf2]'>
														<span
															className={`block h-full rounded-full ${freePercent >= 30 ? 'bg-emerald-500' : freePercent >= 15 ? 'bg-amber-500' : 'bg-rose-500'}`}
															style={{ width: `${freePercent}%` }}
														/>
													</div>
												</div>
											</Link>

											<div className='flex gap-2 px-3 pb-3'>
												<Link
													href={`/navigate/parking/${parking.id}`}
													className='flex h-9 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-[10px] border border-[#e1e4ed] bg-white px-2 text-[11px] font-bold'
												>
													<Navigation className='size-3.5' /> Yo‘nalish
												</Link>
												<Link
													href={`/reserve/${parking.id}`}
													className='flex h-9 min-w-0 flex-1 items-center justify-center rounded-[10px] bg-[#6c47e0] px-2 text-[11px] font-extrabold text-white'
												>
													Bron qilish
												</Link>
												<button
													type='button'
													onClick={() => toggleFavorite(parking.id)}
													className='grid size-9 shrink-0 place-items-center rounded-[10px] border border-[#e1e4ed] bg-white text-rose-500 active:scale-[0.96]'
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
						<EmptyState
							icon={Users}
							title='Hozircha bo‘sh'
							text='Saqlangan elektron navbatlar shu bo‘limda ko‘rinadi.'
							href='/home'
							action='Topish'
						/>
					) : null}

					{tab === 'routes' ? (
						<EmptyState
							icon={Route}
							title='Hozircha bo‘sh'
							text='Uy, ish va tez-tez ishlatiladigan marshrutlarni shu yerda saqlash mumkin bo‘ladi.'
							href='/home'
							action='Topish'
						/>
					) : null}

					{tab === 'events' ? (
						<EmptyState
							icon={Ticket}
							title='Hozircha bo‘sh'
							text='Saqlangan shahar voqealari shu bo‘limda ko‘rinadi.'
							href='/home'
							action='Topish'
						/>
					) : null}
				</div>
			</div>
		</main>
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
								? 'bg-[#6c47e0] text-white shadow-[0_5px_14px_rgba(108,71,224,0.22)]'
								: 'border border-[#e1e4ed] bg-white text-[#475069]'
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
	place: SavedPlace
	onRemove: () => void
}) {
	return (
		<article className='overflow-hidden rounded-[20px] bg-white shadow-[0_4px_14px_rgba(16,24,40,0.07)] ring-1 ring-[#eaecf2]'>
			<Link
				href={place.parkingId ? `/parking/${place.parkingId}` : '/map'}
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
							<p className='mt-1 truncate text-[11px] text-[#8a91a6]'>
								{place.subtitle}
							</p>
						</div>
						<span className='shrink-0 text-[10px] text-[#8a91a6]'>
							{place.distance}
						</span>
					</div>

					<div className='mt-2.5 flex items-center gap-2'>
						<span className='flex items-center gap-1 text-[12px] font-bold'>
							<Star className='size-3.5 fill-[#fdb022] text-[#fdb022]' />{' '}
							{place.rating}
						</span>
						<span className='rounded-[7px] bg-[#e7f8f0] px-2 py-1 text-[10px] font-extrabold text-[#12b76a]'>
							Ochiq
						</span>
					</div>
				</div>
			</Link>

			<div className='grid grid-cols-2 gap-2 px-3 pb-3'>
				<Link
					href={
						place.parkingId ? `/navigate/parking/${place.parkingId}` : '/map'
					}
					className='flex h-9 items-center justify-center gap-1.5 rounded-[10px] border border-[#e1e4ed] bg-white px-2 text-[11px] font-bold'
				>
					<Navigation className='size-3.5' /> Yo‘nalish
				</Link>
				<button
					type='button'
					onClick={onRemove}
					className='flex h-9 items-center justify-center gap-1.5 rounded-[10px] border border-[#e1e4ed] bg-white px-2 text-[11px] font-bold active:scale-[0.98]'
				>
					<Heart className='size-3.5 text-rose-500' /> Olib tashlash
				</button>
			</div>
		</article>
	)
}

function EmptyState({
	icon: Icon,
	title,
	text,
	href,
	action,
}: {
	icon: LucideIcon
	title: string
	text: string
	href: string
	action: string
}) {
	return (
		<div className='mt-3 rounded-[18px] bg-white px-5 py-7 text-center shadow-[0_4px_14px_rgba(16,24,40,0.06)] ring-1 ring-[#eaecf2]'>
			<span className='mx-auto grid size-11 place-items-center rounded-[13px] bg-[#f5f1ff] text-[#6c47e0]'>
				<Icon className='size-5' />
			</span>
			<h2 className='mt-3 text-[14px] font-extrabold'>{title}</h2>
			<p className='mx-auto mt-2 max-w-67.5 text-[12px] leading-5 text-[#8a91a6]'>
				{text}
			</p>
			<Link
				href={href}
				className='mt-4 inline-flex h-9 items-center gap-1.5 rounded-[10px] bg-[#6c47e0] px-4 text-[12px] font-extrabold text-white'
			>
				{action} <ChevronRight className='size-3.5' />
			</Link>
		</div>
	)
}
