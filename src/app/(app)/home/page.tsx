'use client'

import {
	Bell,
	Building2,
	CalendarDays,
	Car,
	Check,
	ChevronDown,
	ChevronRight,
	CircleParking,
	Clock3,
	Heart,
	History,
	Hospital,
	LocateFixed,
	MapPin,
	Mic,
	Navigation,
	Phone,
	Search,
	Share2,
	ShoppingBag,
	Sparkles,
	Star,
	Store,
	Sun,
	Ticket,
	Utensils,
	WandSparkles,
	Wrench,
	X,
	type LucideIcon,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useRef, useState } from 'react'

import { BottomSheet } from '@/components/ui/bottom-sheet'
import { Toast } from '@/components/ui/toast'
import { HorizontalRail } from '@/components/ui/horizontal-rail'
import { ParkingMap } from '@/components/map/parking-map'
import { ParkingBookingSheet } from '@/components/parking/parking-booking-sheet'
import { useApp } from '@/context/app-context'
import { usePlaceFavorites } from '@/hooks/use-place-favorites'
import { useToast } from '@/hooks/use-toast'
import { CITY_META } from '@/data/city-meta'
import { PARKINGS } from '@/data/parkings'
import { EVENTS } from '@/data/events'
import { PLACES } from '@/data/places'
import { formatNumber, formatUZS } from '@/lib/format'
import type { Place, PlaceCategory } from '@/lib/types'
import { distanceKm } from '@/lib/geo'
import { TRANSPORT_MODES, type TransportMode } from '@/lib/transport'
import { useUserLocation, type LocationError } from '@/lib/use-user-location'

type SortMode = 'distance' | 'rating' | 'free'
type SheetState =
	| { type: 'city' }
	| { type: 'weather' }
	| { type: 'route'; routeId: 'home' | 'work' }
	| { type: 'history' }
	| { type: 'sort' }
	| { type: 'categories' }
	| { type: 'nearby' }
	| { type: 'place'; placeId: string }
	| { type: 'service'; serviceId: string }
	| { type: 'servicesAll' }
	| { type: 'event'; eventId: string }
	| { type: 'events' }
	| { type: 'recommendations' }
	| null

type ServiceItem = {
	id: string
	label: string
	subtitle: string
	icon: LucideIcon
	tone: string
}

const QUICK_ROUTES = [
	{
		id: 'home' as const,
		title: 'Uy',
		address: 'Mirzo Ulug‘bek tumani, Buyuk Ipak Yo‘li',
		minutes: 18,
		distance: 8.4,
		parkingId: 'amir-temur',
		icon: Navigation,
	},
	{
		id: 'work' as const,
		title: 'Ish',
		address: 'Tashkent City, Islom Karimov ko‘chasi',
		minutes: 22,
		distance: 12.6,
		parkingId: 'tashkent-city',
		icon: Building2,
	},
]

const CATEGORIES: {
	id: PlaceCategory | 'transport' | 'queues' | 'more'
	label: string
	icon: LucideIcon
	tone: string
}[] = [
	{
		id: 'all',
		label: 'Barchasi',
		icon: Store,
		tone: 'bg-violet-50 text-violet-600',
	},
	{
		id: 'food',
		label: 'Ovqat',
		icon: Utensils,
		tone: 'bg-amber-50 text-amber-600',
	},
	{
		id: 'parking',
		label: 'Parking',
		icon: CircleParking,
		tone: 'bg-violet-50 text-violet-600',
	},
	{
		id: 'health',
		label: 'Sog‘liq',
		icon: Hospital,
		tone: 'bg-rose-50 text-rose-600',
	},
	{
		id: 'shops',
		label: 'Do‘konlar',
		icon: ShoppingBag,
		tone: 'bg-emerald-50 text-emerald-600',
	},
	{
		id: 'fun',
		label: 'Ko‘ngilochar',
		icon: Ticket,
		tone: 'bg-fuchsia-50 text-fuchsia-600',
	},
	{
		id: 'buildings',
		label: 'Binolar',
		icon: Building2,
		tone: 'bg-indigo-50 text-indigo-600',
	},
	{
		id: 'services',
		label: 'Xizmatlar',
		icon: Wrench,
		tone: 'bg-pink-50 text-pink-600',
	},
	{
		id: 'tourism',
		label: 'Turizm',
		icon: MapPin,
		tone: 'bg-emerald-50 text-emerald-600',
	},
	{
		id: 'transport',
		label: 'Transport',
		icon: Car,
		tone: 'bg-sky-50 text-sky-600',
	},
	{
		id: 'queues',
		label: 'Navbatlar',
		icon: History,
		tone: 'bg-orange-50 text-orange-600',
	},
	{
		id: 'more',
		label: 'Yana',
		icon: Sparkles,
		tone: 'bg-slate-100 text-slate-600',
	},
]

const SERVICES: ServiceItem[] = [
	{
		id: 'table',
		label: 'Stol bron qilish',
		subtitle: 'Stol va parkingni birga rejalang',
		icon: CalendarDays,
		tone: 'text-amber-600',
	},
	{
		id: 'parking',
		label: 'Parking',
		subtitle: 'Joyni oldindan band qiling',
		icon: CircleParking,
		tone: 'text-violet-600',
	},
	{
		id: 'cinema',
		label: 'Kino chiptasi',
		subtitle: 'Joy tanlash va bron',
		icon: Ticket,
		tone: 'text-sky-600',
	},
	{
		id: 'clinic',
		label: 'Klinikaga yozilish',
		subtitle: 'Bugungi bo‘sh vaqtlar',
		icon: Hospital,
		tone: 'text-rose-600',
	},
	{
		id: 'queue',
		label: 'Elektron navbat',
		subtitle: 'Uydan turib navbat oling',
		icon: History,
		tone: 'text-orange-600',
	},
	{
		id: 'taxi',
		label: 'Taksi',
		subtitle: 'Kelish vaqti 3–5 daqiqa',
		icon: Car,
		tone: 'text-emerald-600',
	},
]

const AI_TIPS = [
	{
		title: 'Parkingni hozirroq band qiling',
		text: 'Kechki payt markazdagi parkinglar tezroq to‘ladi. Hozir bo‘sh joy ko‘proq.',
		action: 'Parking tanlash',
		parkingId: 'tashkent-city',
	},
	{
		title: 'Magic City uchun yaxshi vaqt',
		text: 'Hozir mavjud joylar yetarli, kechga yaqin yuklama oshadi.',
		action: 'Bron qilish',
		parkingId: 'magic-city',
	},
	{
		title: 'Markazga yo‘l',
		text: 'Tashkent City Parking markazdagi eng ko‘p bo‘sh joyga ega variantlardan biri.',
		action: 'Yo‘nalish',
		parkingId: 'tashkent-city',
	},
	{
		title: 'Yaqin alternativ',
		text: 'Agar parking TO‘LA bo‘lsa, ilova mavjud bo‘sh joyli alternativni ko‘rsatadi.',
		action: 'Xaritada ko‘rish',
		parkingId: 'amir-temur',
	},
]

const BOOKING_SLOTS = ['11:30', '12:00', '12:30', '13:00', '18:00', '19:00']

function locationMessage(error: LocationError) {
	switch (error) {
		case 'denied':
			return 'Joylashuvga ruxsat berilmadi. Masofa demo Toshkent markazidan hisoblanmoqda.'
		case 'timeout':
			return 'GPS javob bermadi. Masofa demo Toshkent markazidan hisoblanmoqda.'
		case 'unavailable':
			return 'Qurilma joylashuvni aniqlay olmadi. Demo joylashuv ishlatilmoqda.'
		case 'outside-uzbekistan':
			return 'Joylashuv O‘zbekiston hududidan tashqarida. Demo Toshkent markazi ishlatilmoqda.'
		case 'unsupported':
			return 'Bu brauzer geolokatsiyani qo‘llamaydi. Demo joylashuv ishlatilmoqda.'
		default:
			return 'GPS hozir mavjud emas. Demo joylashuv ishlatilmoqda.'
	}
}

function searchMatches(text: string, query: string) {
	const normalized = query.trim().toLowerCase()
	if (!normalized) return false
	const haystack = text.toLowerCase()
	if (haystack.includes(normalized)) return true
	const tokens = normalized.split(/\s+/).filter(token => token.length > 2)
	return tokens.some(token => haystack.includes(token))
}

export default function HomePage() {
	const router = useRouter()
	const {
		user,
		reservations,
		favorites,
		toggleFavorite,
		unreadCount,
	} = useApp()
	const { location, status, error: locationError, locate } = useUserLocation()

	const [selectedCity, setSelectedCity] = useState('Toshkent')
	const [selectedParkingId, setSelectedParkingId] = useState<string | null>(
		null,
	)
	const [transportMode, setTransportMode] = useState<TransportMode>('car')
	const [activeCategory, setActiveCategory] = useState<PlaceCategory>('all')
	const [sortMode, setSortMode] = useState<SortMode>('distance')
	const [favoriteOnly, setFavoriteOnly] = useState(false)
	const placeFavorites = usePlaceFavorites()
	const favoritePlaceIds = placeFavorites.ids
	const [sheet, setSheet] = useState<SheetState>(null)
	const [searchOpen, setSearchOpen] = useState(false)
	const [searchQuery, setSearchQuery] = useState('')
	const [recentQueries, setRecentQueries] = useState([
		'Magic City',
		'parking yaqin',
		'Coffee Lab',
		'24/7 parking',
	])
	const [voiceOpen, setVoiceOpen] = useState(false)
	const [voiceText, setVoiceText] = useState('Gapiring…')
	const toast = useToast<string>()
	const [aiIndex, setAiIndex] = useState(0)
	const [bookingSlot, setBookingSlot] = useState('12:30')
	const [bookingCount, setBookingCount] = useState(2)
	const [bookingParkingId, setBookingParkingId] = useState<string | null>(
		null,
	)
	const [updatedLabel, setUpdatedLabel] = useState('hozirgina')

	const voiceTimer = useRef<number | null>(null)
	const voiceDoneTimer = useRef<number | null>(null)
	const nearbyRef = useRef<HTMLElement>(null)

	const cities = useMemo(
		() => Array.from(new Set(PARKINGS.map(parking => parking.city))),
		[],
	)

	const parkingResults = useMemo(() => {
		let list = PARKINGS.filter(parking => parking.city === selectedCity)
			.filter(parking => !favoriteOnly || favorites.includes(parking.id))
			.map(parking => ({ parking, distance: distanceKm(location, parking) }))

		if (sortMode === 'free') {
			list = [...list].sort(
				(a, b) => b.parking.availableSpaces - a.parking.availableSpaces,
			)
		} else if (sortMode === 'rating') {
			list = [...list].sort(
				(a, b) => b.parking.totalSpaces - a.parking.totalSpaces,
			)
		} else {
			list = [...list].sort((a, b) => a.distance - b.distance)
		}

		return list
	}, [favorites, favoriteOnly, location, selectedCity, sortMode])

	const mapParkings = useMemo(
		() => parkingResults.map(({ parking }) => parking),
		[parkingResults],
	)

	const selectedParking = useMemo(
		() => PARKINGS.find(parking => parking.id === selectedParkingId),
		[selectedParkingId],
	)

	const visiblePlaces = useMemo(() => {
		let list = PLACES.filter(
			place => activeCategory === 'all' || place.category === activeCategory,
		)
		if (favoriteOnly)
			list = list.filter(place => favoritePlaceIds.includes(place.id))
		if (sortMode === 'rating')
			list = [...list].sort((a, b) => b.rating - a.rating)
		else if (sortMode === 'free')
			list = [...list].sort((a, b) => (b.free ?? 0) - (a.free ?? 0))
		else list = [...list].sort((a, b) => a.distanceKm - b.distanceKm)
		return list
	}, [activeCategory, favoriteOnly, favoritePlaceIds, sortMode])

	const activeReservation = reservations.find(
		reservation => reservation.status === 'active',
	)
	const meta = CITY_META[selectedCity] ?? CITY_META.Toshkent
	const aiTip = AI_TIPS[aiIndex]

	function showToast(message: string) {
		toast.show(message)
	}

	function rememberQuery(value: string) {
		const q = value.trim()
		if (!q) return
		setRecentQueries(current =>
			[q, ...current.filter(item => item !== q)].slice(0, 6),
		)
	}

	function openSearch() {
		setSearchQuery('')
		setSearchOpen(true)
	}

	function startVoice() {
		if (voiceTimer.current) window.clearTimeout(voiceTimer.current)
		if (voiceDoneTimer.current) window.clearTimeout(voiceDoneTimer.current)
		setSearchOpen(true)
		setVoiceOpen(true)
		setVoiceText('Gapiring…')

		const phrases = [
			'parking yaqin',
			'Magic City',
			'Coffee Lab',
			'Tashkent City parking',
		]
		const phrase = phrases[Math.floor(Math.random() * phrases.length)]

		voiceTimer.current = window.setTimeout(() => {
			setVoiceText(`“${phrase}”`)
			voiceDoneTimer.current = window.setTimeout(() => {
				setVoiceOpen(false)
				setSearchQuery(phrase)
				rememberQuery(phrase)
			}, 650)
		}, 1400)
	}

	function stopVoice() {
		if (voiceTimer.current) window.clearTimeout(voiceTimer.current)
		if (voiceDoneTimer.current) window.clearTimeout(voiceDoneTimer.current)
		setVoiceOpen(false)
	}

	function selectParking(parkingId: string) {
		setSelectedParkingId(parkingId)
		window.setTimeout(() => {
			document
				.getElementById('parking-map')
				?.scrollIntoView({ behavior: 'smooth', block: 'center' })
		}, 60)
	}

	function chooseCategory(id: PlaceCategory | 'transport' | 'queues' | 'more') {
		if (id === 'more') {
			setSheet({ type: 'categories' })
			return
		}
		if (id === 'transport') {
			setSheet({ type: 'route', routeId: 'work' })
			return
		}
		if (id === 'queues') {
			setBookingSlot('12:30')
			setBookingCount(1)
			setSheet({ type: 'service', serviceId: 'queue' })
			return
		}

		setActiveCategory(id)
		setFavoriteOnly(false)
		window.setTimeout(
			() =>
				nearbyRef.current?.scrollIntoView({
					behavior: 'smooth',
					block: 'start',
				}),
			60,
		)
	}

	function togglePlaceFavorite(placeId: string) {
		const place = PLACES.find(item => item.id === placeId)
		const isFavorite = placeFavorites.has(placeId)

		placeFavorites.toggle(placeId)

		showToast(
			place
				? isFavorite
					? `${place.title}: sevimlilardan olib tashlandi`
					: `${place.title}: sevimlilarga qo‘shildi`
				: 'Sevimlilar yangilandi',
		)
	}

	function openPlace(placeId: string) {
		setSheet({ type: 'place', placeId })
	}

	function openParkingBooking(parkingId: string) {
		const parking = PARKINGS.find(item => item.id === parkingId)
		if (!parking) {
			showToast('Parking topilmadi')
			return
		}
		if (parking.availableSpaces <= 0) {
			showToast('Bu parking hozir to‘la')
			return
		}
		// Booking replaces whatever sheet asked for it (the place sheet), the
		// way the old setSheet({ type: 'parkingBook' }) did.
		setSheet(null)
		setBookingParkingId(parkingId)
	}

	function openService(serviceId: string) {
		if (serviceId === 'parking') {
			const target = parkingResults.find(
				({ parking }) => parking.availableSpaces > 0,
			)?.parking
			if (target) openParkingBooking(target.id)
			else showToast('Hozir bo‘sh parking topilmadi')
			return
		}
		if (serviceId === 'taxi') {
			showToast('Taksi: kelish vaqti 3–5 daqiqa · taxminiy 18 000 so‘m')
			return
		}
		setBookingSlot('12:30')
		setBookingCount(serviceId === 'queue' ? 1 : 2)
		setSheet({ type: 'service', serviceId })
	}

	function confirmService(serviceId: string) {
		const service = SERVICES.find(item => item.id === serviceId)
		setSheet(null)
		showToast(`${service?.label ?? 'Bron'} tasdiqlandi · ${bookingSlot}`)
	}

	function sharePlace(place: Place) {
		if (navigator.share) {
			void navigator
				.share({ title: place.title, text: place.address })
				.catch(() => undefined)
			return
		}
		if (navigator.clipboard) {
			void navigator.clipboard.writeText(`${place.title} — ${place.address}`)
		}
		showToast('Joy ma’lumoti nusxalandi')
	}

	function refreshHome() {
		setUpdatedLabel('hozirgina')
		showToast('Ma’lumotlar yangilandi')
		locate()
	}

	const searchLower = searchQuery.trim().toLowerCase()
	const searchParkings = searchLower
		? PARKINGS.filter(parking =>
				searchMatches(
					`${parking.name} ${parking.city} ${parking.district} ${parking.address} ${parking.workingHours} parking`,
					searchLower,
				),
			)
		: []
	const searchPlaces = searchLower
		? PLACES.filter(place =>
				searchMatches(
					`${place.title} ${place.subtitle} ${place.address} ${place.tags.join(' ')}`,
					searchLower,
				),
			)
		: []
	const searchServices = searchLower
		? SERVICES.filter(service =>
				searchMatches(`${service.label} ${service.subtitle}`, searchLower),
			)
		: []
	const searchEvents = searchLower
		? EVENTS.filter(event =>
				searchMatches(
					`${event.title} ${event.place} ${event.category}`,
					searchLower,
				),
			)
		: []
	const searchTotal =
		searchParkings.length +
		searchPlaces.length +
		searchServices.length +
		searchEvents.length

	const nearbyTitle =
		activeCategory === 'parking'
			? 'Yaqin parkinglar'
			: activeCategory === 'all'
				? 'Yaqin joylar'
				: (CATEGORIES.find(category => category.id === activeCategory)?.label ??
					'Yaqin joylar')

	const nearbyCount =
		activeCategory === 'parking' ? parkingResults.length : visiblePlaces.length

	return (
		<div className='-mx-1 space-y-5 pb-4'>
			{/* CITY GO top area */}
			<section className='space-y-3'>
				<div className='flex items-center justify-between gap-3'>
					<button
						type='button'
						onClick={() => setSheet({ type: 'city' })}
						className='inline-flex min-w-0 items-center gap-2 text-left'
					>
						<LocateFixed className='size-5 shrink-0 text-violet-600' />
						<span className='truncate text-lg font-black tracking-tight text-slate-950'>
							{selectedCity}
						</span>
						<ChevronDown className='size-4 shrink-0 text-slate-400' />
					</button>

					<div className='flex items-center gap-2'>
						<button
							type='button'
							onClick={() => setSheet({ type: 'weather' })}
							className='inline-flex h-10 items-center gap-2 rounded-xl bg-amber-50 px-3 text-sm font-black text-amber-700'
						>
							<Sun className='size-5' />
							{meta.temp}°
						</button>
						<Link
							href='/notifications'
							className='relative grid size-10 place-items-center rounded-xl bg-white text-slate-700 shadow-sm ring-1 ring-slate-200'
							aria-label='Bildirishnomalar'
						>
							<Bell className='size-5' />
							{unreadCount > 0 && (
								<span className='absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-black leading-5 text-white'>
									{Math.min(unreadCount, 9)}
								</span>
							)}
						</Link>
					</div>
				</div>

				<div>
					<p className='text-xs font-semibold text-slate-400'>
						Assalomu alaykum, {user?.name ?? 'B SPACE'}
					</p>
					<h1 className='mt-1 text-2xl font-black tracking-tight text-slate-950'>
						Shahar siz uchun
					</h1>
				</div>

				<div className='flex h-14 w-full items-center gap-2 rounded-2xl bg-white px-3 shadow-sm ring-1 ring-slate-200'>
					<button
						type='button'
						onClick={openSearch}
						className='flex min-w-0 flex-1 items-center gap-3 text-left'
					>
						<Search className='size-5 shrink-0 text-slate-400' />
						<span className='min-w-0 flex-1 truncate text-sm text-slate-400'>
							Joy, xizmat yoki manzil qidiring…
						</span>
					</button>
					<button
						type='button'
						onClick={startVoice}
						className='grid size-9 shrink-0 place-items-center rounded-xl bg-violet-50 text-violet-600'
						aria-label='Ovozli qidiruv'
					>
						<Mic className='size-4' />
					</button>
				</div>

				<HorizontalRail className='gap-2'>
					{QUICK_ROUTES.map(route => {
						const Icon = route.icon
						return (
							<button
								key={route.id}
								type='button'
								onClick={() => setSheet({ type: 'route', routeId: route.id })}
								className='inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700'
							>
								<Icon className='size-4 text-violet-600' />
								{route.title} · {route.minutes} daq
							</button>
						)
					})}
					<button
						type='button'
						onClick={() => setFavoriteOnly(value => !value)}
						className={`inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border px-3 text-xs font-bold ${
							favoriteOnly
								? 'border-violet-600 bg-violet-600 text-white'
								: 'border-slate-200 bg-white text-slate-700'
						}`}
					>
						<Heart className='size-4' />
						Sevimlilar · {favorites.length + favoritePlaceIds.length}
					</button>
					<button
						type='button'
						onClick={() => setSheet({ type: 'history' })}
						className='inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700'
					>
						<History className='size-4 text-slate-500' />
						Tarix
					</button>
				</HorizontalRail>
			</section>

			{/* Map + transport strip */}
			<section className='overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200'>
				<div id='parking-map' className='relative scroll-mt-4'>
					<ParkingMap
						parkings={mapParkings}
						selectedParkingId={selectedParkingId}
						onSelect={selectParking}
						userLocation={
							status === 'ready' || status === 'fallback' ? location : undefined
						}
						className='h-61.25'
					/>

					<div className='absolute left-3 top-3 z-20 flex flex-col gap-2'>
						<button
							type='button'
							onClick={() => {
								locate()
								showToast('Joylashuvingiz yangilanmoqda')
							}}
							className='grid size-9 place-items-center rounded-xl bg-white text-violet-600 shadow-md ring-1 ring-slate-200'
							aria-label='Joylashuvim'
						>
							<LocateFixed
								className={`size-4 ${status === 'loading' ? 'animate-pulse' : ''}`}
							/>
						</button>
					</div>

					{selectedParking && (
						<div className='absolute inset-x-3 bottom-14 z-20 flex items-center gap-2 rounded-2xl bg-white p-3 shadow-xl ring-1 ring-slate-200'>
							<span
								className={`grid size-10 shrink-0 place-items-center rounded-xl bg-linear-to-br ${selectedParking.accent} text-white`}
							>
								<CircleParking className='size-5' />
							</span>
							<div className='min-w-0 flex-1'>
								<p className='truncate text-sm font-black text-slate-950'>
									{selectedParking.name}
								</p>
								<p className='mt-0.5 text-[10px] font-semibold text-slate-400'>
									{selectedParking.availableSpaces > 0
										? `${selectedParking.availableSpaces} bo‘sh joy`
										: 'TO‘LA'}{' '}
									· {formatUZS(selectedParking.pricePerHour)}/soat
								</p>
							</div>
							<Link
								href={`/parking/${selectedParking.id}`}
								className='inline-flex h-9 shrink-0 items-center rounded-xl bg-violet-600 px-3 text-[11px] font-black text-white'
							>
								Ochish
							</Link>
							<button
								type='button'
								onClick={() => setSelectedParkingId(null)}
								className='grid size-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-500'
								aria-label='Kartani yopish'
							>
								<X className='size-4' />
							</button>
						</div>
					)}

					<div className='pointer-events-none absolute inset-x-3 bottom-3 z-20 flex items-center justify-between gap-2'>
						<button
							type='button'
							onClick={() => {
								const target = selectedParking ?? parkingResults[0]?.parking
								if (!target) return showToast('Yo‘nalish uchun parking tanlang')
								router.push(`/navigate/parking/${target.id}`)
							}}
							className='pointer-events-auto inline-flex h-9 items-center gap-2 rounded-xl bg-violet-600 px-3 text-xs font-black text-white shadow-lg shadow-violet-600/25'
						>
							<Navigation className='size-4' />
							Yo‘nalish
						</button>
					</div>
				</div>

				<div className='grid grid-cols-4 gap-1 p-2'>
					{TRANSPORT_MODES.map(mode => {
						const Icon = mode.icon
						const selected = transportMode === mode.id
						return (
							<button
								key={mode.id}
								type='button'
								onClick={() => {
									setTransportMode(mode.id)
									const target = selectedParking ?? parkingResults[0]?.parking
									const query = target
										? `?mode=${mode.id}&parkingId=${target.id}`
										: `?mode=${mode.id}`
									router.push(`/transport${query}`)
								}}
								className={`rounded-2xl px-1 py-2.5 text-center transition ${
									selected ? 'bg-violet-50 text-violet-700' : 'text-slate-500'
								}`}
							>
								<Icon className='mx-auto size-5' />
								<p className='mt-1 text-xs font-black'>{mode.time} daq</p>
								<p className='mt-0.5 text-[10px] font-semibold'>{mode.label}</p>
							</button>
						)
					})}
				</div>
			</section>

			{status === 'fallback' && (
				<p className='rounded-2xl bg-amber-50 p-3 text-xs leading-5 text-amber-800'>
					{locationMessage(locationError)}
				</p>
			)}

			{/* Existing B SPACE active-session capability preserved */}
			{activeReservation && (
				<Link
					href={`/session/${activeReservation.id}`}
					className='flex items-center justify-between gap-3 rounded-2xl bg-emerald-500 p-4 text-white shadow-lg shadow-emerald-500/15'
				>
					<div>
						<p className='text-[10px] font-black uppercase tracking-[.18em] text-emerald-50'>
							Faol parking
						</p>
						<p className='mt-1 text-sm font-black'>
							Parking taymeri ishlamoqda
						</p>
					</div>
					<ChevronRight className='size-5' />
				</Link>
			)}

			{/* Categories */}
			<section>
				<div className='mb-3 flex items-end justify-between'>
					<h2 className='text-lg font-black tracking-tight text-slate-950'>
						Kategoriyalar
					</h2>
					<button
						type='button'
						onClick={() => setSheet({ type: 'categories' })}
						className='inline-flex items-center gap-1 text-xs font-black text-violet-600'
					>
						Barchasi <ChevronRight className='size-4' />
					</button>
				</div>

				<div className='grid grid-cols-4 gap-x-3 gap-y-4'>
					{CATEGORIES.map(category => {
						const Icon = category.icon
						const selected = category.id === activeCategory
						return (
							<button
								key={category.id}
								type='button'
								onClick={() => chooseCategory(category.id)}
								className='flex min-w-0 flex-col items-center gap-2 text-center'
							>
								<span
									className={`grid size-12 place-items-center rounded-2xl ${category.tone} ${selected ? 'ring-2 ring-violet-500 ring-offset-2' : ''}`}
								>
									<Icon className='size-5' />
								</span>
								<span
									className={`text-[10px] font-bold leading-3 ${selected ? 'text-violet-700' : 'text-slate-600'}`}
								>
									{category.label}
								</span>
							</button>
						)
					})}
				</div>
			</section>

			{/* Nearby */}
			<section ref={nearbyRef} className='scroll-mt-4'>
				<div className='mb-3 flex items-center justify-between gap-3'>
					<div className='flex min-w-0 items-center gap-2'>
						<h2 className='truncate text-lg font-black tracking-tight text-slate-950'>
							{nearbyTitle}
						</h2>
						<span className='rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-black text-slate-500'>
							{nearbyCount}
						</span>
					</div>
					<button
						type='button'
						onClick={() => setSheet({ type: 'sort' })}
						className='shrink-0 text-xs font-black text-violet-600'
					>
						{sortMode === 'distance'
							? 'Yaqinroq'
							: sortMode === 'rating'
								? 'Reyting'
								: 'Bo‘sh joy'}
					</button>
				</div>

				{activeCategory === 'parking' ? (
					parkingResults.length ? (
						<HorizontalRail className='gap-3'>
							{parkingResults.map(({ parking, distance }) => {
								const favorite = favorites.includes(parking.id)
								return (
									<article
										key={parking.id}
										className='w-44.5 shrink-0 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200'
									>
										<div
											className={`relative h-24 bg-linear-to-br ${parking.accent} p-3 text-white`}
										>
											<button
												type='button'
												onClick={() => toggleFavorite(parking.id)}
												className='absolute right-2 top-2 grid size-8 place-items-center rounded-full bg-white/90 text-slate-700 shadow-sm'
												aria-label='Sevimlilar'
											>
												<Heart
													className={`size-4 ${favorite ? 'fill-rose-500 text-rose-500' : ''}`}
												/>
											</button>
											<span className='absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-lg bg-white/90 px-2 py-1 text-[10px] font-black text-slate-800'>
												<Star className='size-3 fill-amber-400 text-amber-400' />
												4.
												{Math.max(4, Math.min(9, parking.availableSpaces % 10))}
											</span>
										</div>
										<div className='p-3'>
											<button
												type='button'
												onClick={() => selectParking(parking.id)}
												className='block w-full text-left'
											>
												<h3 className='truncate text-sm font-black text-slate-950'>
													{parking.name}
												</h3>
												<p className='mt-1 truncate text-[11px] text-slate-400'>
													{parking.district} · {parking.city}
												</p>
											</button>
											<div className='mt-3 flex items-center justify-between gap-2 text-[10px] font-bold'>
												<span className='text-slate-400'>
													{distance.toFixed(1)} km
												</span>
												<span
													className={
														parking.availableSpaces === 0
															? 'text-rose-500'
															: parking.availableSpaces <= 5
																? 'text-amber-600'
																: 'text-emerald-600'
													}
												>
													{parking.availableSpaces === 0
														? 'TO‘LA'
														: `${parking.availableSpaces} joy`}
												</span>
											</div>
											<div className='mt-3 grid grid-cols-2 gap-2'>
												<button
													type='button'
													onClick={() => selectParking(parking.id)}
													className='inline-flex h-9 items-center justify-center rounded-xl border border-violet-200 text-[10px] font-black text-violet-700'
												>
													Xarita
												</button>
												{parking.availableSpaces > 0 ? (
													<button
														type='button'
														onClick={() => openParkingBooking(parking.id)}
														className='inline-flex h-9 items-center justify-center rounded-xl bg-violet-600 text-[10px] font-black text-white'
													>
														Bron
													</button>
												) : (
													<Link
														href={`/parking/${parking.id}`}
														className='inline-flex h-9 items-center justify-center rounded-xl bg-violet-600 text-[10px] font-black text-white'
													>
														Ochish
													</Link>
												)}
											</div>
										</div>
									</article>
								)
							})}
							<button
								type='button'
								onClick={() => setSheet({ type: 'nearby' })}
								className='flex w-29.5 shrink-0 flex-col items-center justify-center gap-2 rounded-2xl bg-white px-3 text-center shadow-sm ring-1 ring-slate-200'
							>
								<ChevronRight className='size-5 text-violet-600' />
								<span className='text-xs font-black text-violet-700'>
									Barchasini ko‘rish
								</span>
							</button>
						</HorizontalRail>
					) : (
						<div className='rounded-2xl border border-dashed border-slate-300 p-7 text-center text-sm text-slate-500'>
							Mos parking topilmadi.
						</div>
					)
				) : visiblePlaces.length ? (
					<HorizontalRail className='gap-3'>
						{visiblePlaces.map(place => {
							const favorite = favoritePlaceIds.includes(place.id)
							return (
								<article
									key={place.id}
									role='button'
									tabIndex={0}
									onClick={() => openPlace(place.id)}
									onKeyDown={event => {
										if (event.key === 'Enter' || event.key === ' ') {
											event.preventDefault()
											openPlace(place.id)
										}
									}}
									className='w-44 shrink-0 cursor-pointer overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 transition active:scale-[0.985]'
									aria-label={`${place.title} tafsilotlarini ochish`}
								>
									<div
										className={`relative h-24 bg-linear-to-br ${place.accent} p-3 text-white`}
									>
										<button
											type='button'
											onPointerDown={event => event.stopPropagation()}
											onClick={event => {
												event.preventDefault()
												event.stopPropagation()
												togglePlaceFavorite(place.id)
											}}
											className='absolute right-2 top-2 z-10 grid size-8 place-items-center rounded-full bg-white/90 text-slate-700 shadow-sm transition active:scale-95'
											aria-label={
												favorite
													? `${place.title}ni sevimlilardan olib tashlash`
													: `${place.title}ni sevimlilarga qo‘shish`
											}
										>
											<Heart
												className={`size-4 ${favorite ? 'fill-rose-500 text-rose-500' : ''}`}
											/>
										</button>
										<span className='absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-lg bg-white/90 px-2 py-1 text-[10px] font-black text-slate-800'>
											<Star className='size-3 fill-amber-400 text-amber-400' />{' '}
											{place.rating}
										</span>
									</div>
									<div className='w-full p-3 text-left'>
										<h3 className='truncate text-sm font-black text-slate-950'>
											{place.title}
										</h3>
										<p className='mt-1 truncate text-[11px] text-slate-400'>
											{place.subtitle}
										</p>
										<div className='mt-3 flex items-center gap-3 text-[10px] font-bold'>
											<span className='text-slate-400'>
												{place.distanceKm.toFixed(1)} km
											</span>
											{place.free !== undefined && (
												<span className='text-emerald-600'>
													{place.free} joy
												</span>
											)}
											{place.queue !== undefined && (
												<span className='text-slate-600'>
													{place.queue} daq
												</span>
											)}
										</div>
									</div>
								</article>
							)
						})}
						<button
							type='button'
							onClick={() => setSheet({ type: 'nearby' })}
							className='flex w-29.5 shrink-0 flex-col items-center justify-center gap-2 rounded-2xl bg-white px-3 text-center shadow-sm ring-1 ring-slate-200'
						>
							<ChevronRight className='size-5 text-violet-600' />
							<span className='text-xs font-black text-violet-700'>
								Barchasini ko‘rish
							</span>
						</button>
					</HorizontalRail>
				) : (
					<div className='rounded-2xl border border-dashed border-slate-300 p-7 text-center text-sm text-slate-500'>
						Bu kategoriyada sevimli joy topilmadi.
					</div>
				)}
			</section>

			{/* Services — CITY GO layout */}
			<section>
				<div className='mb-2 flex items-baseline justify-between gap-3'>
					<h2 className='text-lg font-[750] tracking-[-0.3px] text-slate-950'>
						Mashhur xizmatlar
					</h2>
					<button
						type='button'
						onClick={() => setSheet({ type: 'servicesAll' })}
						className='inline-flex shrink-0 items-center gap-1 text-[13px] font-semibold text-violet-600'
					>
						Barchasi
						<ChevronRight className='size-3.25' strokeWidth={1.8} />
					</button>
				</div>

				<div className='-mx-4 overflow-hidden'>
					<HorizontalRail className='w-[calc(100%+2rem)] gap-3 px-4 pb-1'>
						{SERVICES.map(service => {
							const Icon = service.icon
							return (
								<button
									key={service.id}
									type='button'
									onClick={() => openService(service.id)}
									className='inline-flex shrink-0 items-center gap-2.5 rounded-[18px] bg-white px-3.5 py-3 text-[13px] font-semibold text-slate-700 shadow-card'
								>
									<Icon
										className={`size-5 shrink-0 ${service.tone}`}
										strokeWidth={1.8}
									/>
									<span className='whitespace-nowrap'>{service.label}</span>
								</button>
							)
						})}
					</HorizontalRail>
				</div>
			</section>

			{/* For you */}
			<section className='overflow-hidden rounded-3xl bg-linear-to-br from-violet-600 to-indigo-700 p-5 text-white shadow-xl shadow-violet-600/15'>
				<div className='flex items-start justify-between gap-3'>
					<div>
						<p className='text-lg font-black'>
							Siz uchun, {user?.name ?? 'B SPACE'}
						</p>
						<p className='mt-1 text-xs leading-5 text-violet-100'>
							Safarlaringiz va parking odatlaringiz asosida
						</p>
					</div>
					<button
						type='button'
						onClick={() => setSheet({ type: 'recommendations' })}
						className='rounded-xl bg-white/15 px-3 py-1.5 text-[10px] font-black'
					>
						Barchasi
					</button>
				</div>

				<button
					type='button'
					onClick={() => setSheet({ type: 'event', eventId: EVENTS[0].id })}
					className='mt-5 flex w-full items-center gap-4 text-left'
				>
					<div className='min-w-0 flex-1'>
						<p className='text-[10px] font-bold text-violet-200'>
							BUGUN · 19:00
						</p>
						<p className='mt-1 truncate text-base font-black'>
							{EVENTS[0].title}
						</p>
						<p className='mt-2 text-xs text-violet-100'>
							{EVENTS[0].place} · yaqin parking mavjud.
						</p>
					</div>
					<div className='grid size-16 shrink-0 place-items-center rounded-2xl bg-white/15'>
						<Ticket className='size-8' />
					</div>
				</button>
			</section>

			{/* Events */}
			<section>
				<div className='mb-3 flex items-center justify-between'>
					<h2 className='text-lg font-black tracking-tight text-slate-950'>
						Shahardagi voqealar
					</h2>
					<button
						type='button'
						onClick={() => setSheet({ type: 'events' })}
						className='text-xs font-black text-violet-600'
					>
						Barchasi
					</button>
				</div>
				<HorizontalRail className='gap-3'>
					{EVENTS.map(event => (
						<button
							key={event.id}
							type='button'
							onClick={() => setSheet({ type: 'event', eventId: event.id })}
							className='w-40 shrink-0 overflow-hidden rounded-2xl bg-white text-left shadow-sm ring-1 ring-slate-200'
						>
							<div className={`h-24 bg-linear-to-br ${event.accent} p-3`}>
								<span className='rounded-lg bg-white/90 px-2 py-1 text-[10px] font-black text-slate-800'>
									{event.when}
								</span>
							</div>
							<div className='p-3'>
								<p className='text-[10px] font-bold text-slate-400'>
									{event.time} · {event.category}
								</p>
								<p className='mt-1 truncate text-sm font-black text-slate-900'>
									{event.title}
								</p>
								<p className='mt-2 truncate text-[10px] text-slate-400'>
									{event.place}
								</p>
							</div>
						</button>
					))}
				</HorizontalRail>
			</section>

			{/* AI recommendation */}
			<section className='rounded-2xl border border-violet-100 bg-linear-to-br from-violet-50 to-sky-50 p-4'>
				<div className='flex gap-3'>
					<span className='grid size-10 shrink-0 place-items-center rounded-xl bg-violet-600 text-white'>
						<WandSparkles className='size-5' />
					</span>
					<div className='min-w-0 flex-1'>
						<div className='flex items-center justify-between gap-2'>
							<span className='inline-flex items-center gap-1 text-xs font-black text-violet-700'>
								<Sparkles className='size-3.5' /> AI tavsiya
							</span>
							<button
								type='button'
								onClick={() =>
									setAiIndex(index => (index + 1) % AI_TIPS.length)
								}
								className='inline-flex items-center gap-1 text-[10px] font-bold text-slate-400'
							>
								{aiIndex + 1}/{AI_TIPS.length}{' '}
								<History className='size-3.5 text-violet-600' />
							</button>
						</div>
						<p className='mt-2 text-sm font-black text-slate-900'>
							{aiTip.title}
						</p>
						<p className='mt-1 text-xs leading-5 text-slate-500'>
							{aiTip.text}
						</p>
						<button
							type='button'
							onClick={() => {
								if (aiIndex === 1) openParkingBooking(aiTip.parkingId)
								else if (aiIndex === 2)
									router.push(`/navigate/parking/${aiTip.parkingId}`)
								else selectParking(aiTip.parkingId)
							}}
							className='mt-3 inline-flex h-9 items-center gap-2 rounded-xl bg-violet-600 px-3 text-xs font-black text-white'
						>
							<CircleParking className='size-4' /> {aiTip.action}
						</button>
					</div>
				</div>
			</section>

			<button
				type='button'
				onClick={refreshHome}
				className='flex w-full items-center justify-center gap-2 px-1 text-[10px] font-semibold text-slate-400'
			>
				<History className='size-3.5' /> Ma’lumotlar {updatedLabel} yangilandi ·
				yangilash uchun bosing
			</button>

			{/* SEARCH OVERLAY */}
			{searchOpen && (
				<section className='fixed inset-0 z-90 mx-auto flex w-full max-w-md flex-col bg-slate-50'>
					<div className='flex items-center gap-2 px-4 pb-3 pt-[max(1rem,env(safe-area-inset-top))]'>
						<button
							type='button'
							onClick={() => setSearchOpen(false)}
							className='grid size-11 shrink-0 place-items-center rounded-xl bg-white text-slate-600 shadow-sm ring-1 ring-slate-200'
						>
							<X className='size-5' />
						</button>
						<div className='flex h-12 min-w-0 flex-1 items-center gap-2 rounded-2xl bg-white px-3 shadow-sm ring-1 ring-slate-200'>
							<Search className='size-5 shrink-0 text-slate-400' />
							<input
								autoFocus
								value={searchQuery}
								onChange={event => setSearchQuery(event.target.value)}
								className='min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400'
								placeholder='Joy, xizmat, parking…'
							/>
							{searchQuery && (
								<button
									type='button'
									onClick={() => setSearchQuery('')}
									className='grid size-7 place-items-center text-slate-400'
								>
									<X className='size-4' />
								</button>
							)}
							<button
								type='button'
								onClick={startVoice}
								className='grid size-8 place-items-center text-violet-600'
							>
								<Mic className='size-4' />
							</button>
						</div>
					</div>

					<div className='flex-1 overflow-y-auto px-4 pb-8'>
						{!searchQuery.trim() ? (
							<div className='space-y-5'>
								<div>
									<p className='mb-2 text-[11px] font-black uppercase tracking-[.14em] text-slate-400'>
										So‘nggi qidiruvlar
									</p>
									<div className='overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200'>
										{recentQueries.map((query, index) => (
											<button
												key={query}
												type='button'
												onClick={() => setSearchQuery(query)}
												className={`flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-semibold text-slate-700 ${index ? 'border-t border-slate-100' : ''}`}
											>
												<History className='size-4 text-slate-400' />
												<span className='min-w-0 flex-1 truncate'>{query}</span>
												<ChevronRight className='size-4 text-slate-300' />
											</button>
										))}
									</div>
								</div>

								<div>
									<p className='mb-2 text-[11px] font-black uppercase tracking-[.14em] text-slate-400'>
										Hozir mashhur
									</p>
									<HorizontalRail className='gap-2'>
										{[
											'Coffee Lab',
											'parking 24/7',
											'Magic City',
											'klinika',
											'kino',
										].map(query => (
											<button
												key={query}
												type='button'
												onClick={() => setSearchQuery(query)}
												className='h-10 shrink-0 rounded-xl bg-white px-3 text-xs font-bold text-slate-700 shadow-sm ring-1 ring-slate-200'
											>
												{query}
											</button>
										))}
									</HorizontalRail>
								</div>

								<div>
									<p className='mb-3 text-[11px] font-black uppercase tracking-[.14em] text-slate-400'>
										Kategoriyalar
									</p>
									<div className='grid grid-cols-4 gap-3'>
										{CATEGORIES.slice(1, 9).map(category => {
											const Icon = category.icon
											return (
												<button
													key={category.id}
													type='button'
													onClick={() => {
														setSearchOpen(false)
														chooseCategory(category.id)
													}}
													className='flex flex-col items-center gap-2 text-center'
												>
													<span
														className={`grid size-11 place-items-center rounded-2xl ${category.tone}`}
													>
														<Icon className='size-5' />
													</span>
													<span className='text-[10px] font-bold text-slate-600'>
														{category.label}
													</span>
												</button>
											)
										})}
									</div>
								</div>
							</div>
						) : searchTotal ? (
							<div className='space-y-5'>
								{searchParkings.length > 0 && (
									<div>
										<p className='mb-2 text-[11px] font-black uppercase tracking-[.14em] text-slate-400'>
											Parking · {searchParkings.length}
										</p>
										<div className='overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200'>
											{searchParkings.map((parking, index) => (
												<button
													key={parking.id}
													type='button'
													onClick={() => {
														rememberQuery(searchQuery)
														setSearchOpen(false)
														setSelectedCity(parking.city)
														selectParking(parking.id)
													}}
													className={`flex w-full items-center gap-3 px-4 py-3 text-left ${index ? 'border-t border-slate-100' : ''}`}
												>
													<span
														className={`grid size-10 shrink-0 place-items-center rounded-xl bg-linear-to-br ${parking.accent} text-white`}
													>
														<CircleParking className='size-5' />
													</span>
													<span className='min-w-0 flex-1'>
														<span className='block truncate text-sm font-black text-slate-900'>
															{parking.name}
														</span>
														<span className='mt-0.5 block truncate text-[11px] text-slate-400'>
															{parking.address}
														</span>
													</span>
													<span
														className={`text-[10px] font-black ${parking.availableSpaces > 0 ? 'text-emerald-600' : 'text-rose-500'}`}
													>
														{parking.availableSpaces > 0
															? `${parking.availableSpaces} joy`
															: 'TO‘LA'}
													</span>
												</button>
											))}
										</div>
									</div>
								)}

								{searchPlaces.length > 0 && (
									<div>
										<p className='mb-2 text-[11px] font-black uppercase tracking-[.14em] text-slate-400'>
											Joylar · {searchPlaces.length}
										</p>
										<div className='overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200'>
											{searchPlaces.map((place, index) => (
												<button
													key={place.id}
													type='button'
													onClick={() => {
														rememberQuery(searchQuery)
														setSearchOpen(false)
														setSheet({ type: 'place', placeId: place.id })
													}}
													className={`flex w-full items-center gap-3 px-4 py-3 text-left ${index ? 'border-t border-slate-100' : ''}`}
												>
													<span
														className={`grid size-10 shrink-0 place-items-center rounded-xl bg-linear-to-br ${place.accent} text-white`}
													>
														<MapPin className='size-5' />
													</span>
													<span className='min-w-0 flex-1'>
														<span className='block truncate text-sm font-black text-slate-900'>
															{place.title}
														</span>
														<span className='mt-0.5 block truncate text-[11px] text-slate-400'>
															{place.subtitle}
														</span>
													</span>
													<Star className='size-4 fill-amber-400 text-amber-400' />
												</button>
											))}
										</div>
									</div>
								)}

								{searchServices.length > 0 && (
									<div>
										<p className='mb-2 text-[11px] font-black uppercase tracking-[.14em] text-slate-400'>
											Xizmatlar · {searchServices.length}
										</p>
										<div className='overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200'>
											{searchServices.map((service, index) => {
												const Icon = service.icon
												return (
													<button
														key={service.id}
														type='button'
														onClick={() => {
															rememberQuery(searchQuery)
															setSearchOpen(false)
															openService(service.id)
														}}
														className={`flex w-full items-center gap-3 px-4 py-3 text-left ${index ? 'border-t border-slate-100' : ''}`}
													>
														<span className='grid size-10 shrink-0 place-items-center rounded-xl bg-violet-50'>
															<Icon className={`size-5 ${service.tone}`} />
														</span>
														<span className='min-w-0 flex-1 text-sm font-black text-slate-900'>
															{service.label}
														</span>
														<ChevronRight className='size-4 text-slate-300' />
													</button>
												)
											})}
										</div>
									</div>
								)}

								{searchEvents.length > 0 && (
									<div>
										<p className='mb-2 text-[11px] font-black uppercase tracking-[.14em] text-slate-400'>
											Voqealar · {searchEvents.length}
										</p>
										<div className='overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200'>
											{searchEvents.map((event, index) => (
												<button
													key={event.id}
													type='button'
													onClick={() => {
														rememberQuery(searchQuery)
														setSearchOpen(false)
														setSheet({ type: 'event', eventId: event.id })
													}}
													className={`flex w-full items-center gap-3 px-4 py-3 text-left ${index ? 'border-t border-slate-100' : ''}`}
												>
													<span className='grid size-10 shrink-0 place-items-center rounded-xl bg-fuchsia-50 text-fuchsia-600'>
														<Ticket className='size-5' />
													</span>
													<span className='min-w-0 flex-1'>
														<span className='block truncate text-sm font-black text-slate-900'>
															{event.title}
														</span>
														<span className='mt-0.5 block text-[11px] text-slate-400'>
															{event.when} · {event.time}
														</span>
													</span>
												</button>
											))}
										</div>
									</div>
								)}
							</div>
						) : (
							<div className='mt-10 rounded-3xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200'>
								<Search className='mx-auto size-8 text-slate-300' />
								<p className='mt-3 text-sm font-black text-slate-900'>
									Hech narsa topilmadi
								</p>
								<p className='mt-2 text-xs leading-5 text-slate-400'>
									Qidiruvni qisqartirib yoki boshqa so‘z bilan sinab ko‘ring.
								</p>
								<button
									type='button'
									onClick={() => setSearchQuery('')}
									className='mt-4 h-10 rounded-xl border border-slate-200 px-4 text-xs font-black text-slate-700'
								>
									Tozalash
								</button>
							</div>
						)}
					</div>
				</section>
			)}

			{/* VOICE OVERLAY */}
			{voiceOpen && (
				<div className='fixed inset-0 z-100 mx-auto flex w-full max-w-md flex-col items-center justify-center gap-6 bg-slate-950/75 px-8 text-center text-white backdrop-blur-md'>
					<div className='grid size-28 place-items-center rounded-full bg-violet-600 shadow-2xl shadow-violet-500/30'>
						<Mic className='size-11' />
					</div>
					<div>
						<p className='text-xl font-black'>{voiceText}</p>
						<p className='mt-2 text-sm text-white/65'>
							Masalan: “parking yaqin” yoki “Magic City”
						</p>
					</div>
					<button
						type='button'
						onClick={stopVoice}
						className='h-11 rounded-xl bg-white/15 px-5 text-sm font-black'
					>
						Bekor qilish
					</button>
				</div>
			)}

			{/* SHEETS */}
			{sheet?.type === 'city' && (
				<BottomSheet title='Shaharni tanlang' onClose={() => setSheet(null)}>
					<p className='mb-3 text-xs leading-5 text-slate-500'>
						Parkinglar, masofalar va shahar ma’lumotlari tanlangan shaharga
						moslashadi.
					</p>
					<div className='overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200'>
						{cities.map((city, index) => {
							const cityMeta = CITY_META[city] ?? CITY_META.Toshkent
							return (
								<button
									key={city}
									type='button'
									onClick={() => {
										setSelectedCity(city)
										setSelectedParkingId(null)
										setSheet(null)
										showToast(`Shahar: ${city}`)
									}}
									className={`flex w-full items-center gap-3 px-4 py-3 text-left ${index ? 'border-t border-slate-100' : ''}`}
								>
									<span className='grid size-10 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-600'>
										<Sun className='size-5' />
									</span>
									<span className='min-w-0 flex-1'>
										<span className='block text-sm font-black text-slate-900'>
											{city}
										</span>
										<span className='mt-0.5 block text-[11px] text-slate-400'>
											{cityMeta.temp}° · {cityMeta.sky} · {cityMeta.population}
										</span>
									</span>
									{selectedCity === city ? (
										<Check className='size-5 text-violet-600' />
									) : (
										<ChevronRight className='size-4 text-slate-300' />
									)}
								</button>
							)
						})}
					</div>
				</BottomSheet>
			)}

			{sheet?.type === 'weather' && (
				<BottomSheet
					title={`${selectedCity} ob-havosi`}
					onClose={() => setSheet(null)}
				>
					<div className='rounded-3xl bg-white p-5 text-center shadow-sm ring-1 ring-slate-200'>
						<Sun className='mx-auto size-12 text-amber-500' />
						<p className='mt-3 text-4xl font-black text-slate-950'>
							{meta.temp}°
						</p>
						<p className='mt-1 text-sm text-slate-500'>
							{meta.sky} · his qilinishi {meta.temp + 2}°
						</p>
					</div>
					<div className='mt-3 grid grid-cols-3 gap-2'>
						{[
							['Shamol', '3 m/s'],
							['Namlik', '28%'],
							['AQI', '32'],
							['UV indeks', '7'],
							['Quyosh chiqishi', '05:12'],
							['Quyosh botishi', '19:38'],
						].map(([label, value]) => (
							<div
								key={label}
								className='rounded-2xl bg-white p-3 text-center shadow-sm ring-1 ring-slate-200'
							>
								<Sun className='mx-auto size-4 text-violet-600' />
								<p className='mt-2 text-sm font-black text-slate-900'>
									{value}
								</p>
								<p className='mt-1 text-[10px] leading-4 text-slate-400'>
									{label}
								</p>
							</div>
						))}
					</div>
					<div className='mt-3 rounded-2xl border border-violet-100 bg-violet-50 p-4'>
						<p className='text-xs font-black text-violet-700'>
							Bugungi tavsiya
						</p>
						<p className='mt-1 text-xs leading-5 text-slate-600'>
							Ertalab piyoda va skuter uchun qulay. Tush payti issiqroq bo‘ladi.
						</p>
					</div>
				</BottomSheet>
			)}

			{sheet?.type === 'route' &&
				(() => {
					const route =
						QUICK_ROUTES.find(item => item.id === sheet.routeId) ??
						QUICK_ROUTES[0]
					return (
						<BottomSheet
							title={`Marshrut: ${route.title}`}
							onClose={() => setSheet(null)}
						>
							<div className='flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200'>
								<span className='grid size-11 shrink-0 place-items-center rounded-xl bg-violet-50 text-violet-600'>
									<Building2 className='size-5' />
								</span>
								<div className='min-w-0'>
									<p className='text-sm font-black text-slate-900'>
										{route.title}
									</p>
									<p className='mt-1 text-xs leading-5 text-slate-400'>
										{route.address}
									</p>
								</div>
							</div>
							<div className='mt-3 grid grid-cols-2 gap-3'>
								{TRANSPORT_MODES.map(mode => {
									const Icon = mode.icon
									const minutes = Math.round((route.minutes * mode.time) / 15)
									return (
										<button
											key={mode.id}
											type='button'
											onClick={() => setTransportMode(mode.id)}
											className={`rounded-2xl bg-white p-4 text-center shadow-sm ring-1 ${transportMode === mode.id ? 'ring-violet-500' : 'ring-slate-200'}`}
										>
											<Icon className='mx-auto size-5 text-violet-600' />
											<p className='mt-2 text-lg font-black text-slate-950'>
												{minutes} daq
											</p>
											<p className='mt-1 text-xs text-slate-400'>
												{mode.label}
											</p>
										</button>
									)
								})}
							</div>
							<div className='mt-3 rounded-2xl border border-violet-100 bg-violet-50 p-4'>
								<p className='text-xs font-black text-violet-700'>
									Eng tez — avto
								</p>
								<p className='mt-1 text-xs leading-5 text-slate-600'>
									{route.distance} km, tirbandlik o‘rtacha. Maqsad yaqinida
									parking mavjud.
								</p>
							</div>
							<button
								type='button'
								onClick={() => {
									setSheet(null)
									router.push(`/navigate/parking/${route.parkingId}`)
								}}
								className='mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-violet-600 text-sm font-black text-white'
							>
								<Navigation className='size-5' /> Marshrutni ochish
							</button>
						</BottomSheet>
					)
				})()}

			{sheet?.type === 'history' && (
				<BottomSheet title='Tarix' onClose={() => setSheet(null)}>
					{reservations.length ? (
						<div className='overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200'>
							{reservations.slice(0, 6).map((reservation, index) => {
								const parking = PARKINGS.find(
									item => item.id === reservation.parkingId,
								)
								return (
									<Link
										key={reservation.id}
										href='/bookings'
										onClick={() => setSheet(null)}
										className={`flex items-center gap-3 px-4 py-3 ${index ? 'border-t border-slate-100' : ''}`}
									>
										<span
											className={`grid size-10 shrink-0 place-items-center rounded-xl bg-linear-to-br ${parking?.accent ?? 'from-slate-500 to-slate-800'} text-white`}
										>
											<CircleParking className='size-5' />
										</span>
										<span className='min-w-0 flex-1'>
											<span className='block truncate text-sm font-black text-slate-900'>
												{parking?.name ?? 'Parking'}
											</span>
											<span className='mt-0.5 block text-[11px] text-slate-400'>
												{reservation.status} · {reservation.durationHours} soat
											</span>
										</span>
										<ChevronRight className='size-4 text-slate-300' />
									</Link>
								)
							})}
						</div>
					) : (
						<div className='rounded-2xl bg-white p-6 text-center text-sm text-slate-500 shadow-sm ring-1 ring-slate-200'>
							Hali bron tarixi yo‘q.
						</div>
					)}
					<Link
						href='/bookings'
						onClick={() => setSheet(null)}
						className='mt-4 flex h-12 items-center justify-center rounded-2xl bg-violet-600 text-sm font-black text-white'
					>
						Barcha bronlar
					</Link>
				</BottomSheet>
			)}

			{sheet?.type === 'sort' && (
				<BottomSheet title='Saralash va filtr' onClose={() => setSheet(null)}>
					<div className='overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200'>
						{(
							[
								['distance', 'Eng yaqin'],
								['rating', 'Yuqori reyting'],
								['free', 'Ko‘p bo‘sh joy'],
							] as [SortMode, string][]
						).map(([id, label], index) => (
							<button
								key={id}
								type='button'
								onClick={() => {
									setSortMode(id)
									setSheet(null)
									showToast('Ro‘yxat saralandi')
								}}
								className={`flex w-full items-center gap-3 px-4 py-3 text-left ${index ? 'border-t border-slate-100' : ''}`}
							>
								<span className='grid size-10 shrink-0 place-items-center rounded-xl bg-violet-50 text-violet-600'>
									<Sparkles className='size-5' />
								</span>
								<span className='min-w-0 flex-1 text-sm font-black text-slate-900'>
									{label}
								</span>
								{sortMode === id && (
									<Check className='size-5 text-violet-600' />
								)}
							</button>
						))}
					</div>
					<button
						type='button'
						onClick={() => setFavoriteOnly(value => !value)}
						className='mt-3 flex w-full items-center justify-between rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200'
					>
						<span className='text-sm font-black text-slate-900'>
							Faqat sevimlilar
						</span>
						<span
							className={`relative h-7 w-12 rounded-full transition ${favoriteOnly ? 'bg-violet-600' : 'bg-slate-200'}`}
						>
							<span
								className={`absolute top-1 size-5 rounded-full bg-white shadow transition ${favoriteOnly ? 'left-6' : 'left-1'}`}
							/>
						</span>
					</button>
				</BottomSheet>
			)}

			{sheet?.type === 'categories' && (
				<BottomSheet
					title='Barcha kategoriyalar'
					onClose={() => setSheet(null)}
				>
					<div className='grid grid-cols-3 gap-x-3 gap-y-5'>
						{CATEGORIES.map(category => {
							const Icon = category.icon
							return (
								<button
									key={category.id}
									type='button'
									onClick={() => {
										setSheet(null)
										chooseCategory(category.id)
									}}
									className='flex flex-col items-center gap-2 text-center'
								>
									<span
										className={`grid size-12 place-items-center rounded-2xl ${category.tone}`}
									>
										<Icon className='size-5' />
									</span>
									<span className='text-[11px] font-bold text-slate-600'>
										{category.label}
									</span>
								</button>
							)
						})}
					</div>
				</BottomSheet>
			)}

			{sheet?.type === 'nearby' && (
				<BottomSheet
					title={`${nearbyTitle} · ${nearbyCount}`}
					onClose={() => setSheet(null)}
				>
					<div className='space-y-2'>
						{activeCategory === 'parking'
							? parkingResults.map(({ parking, distance }) => (
									<div
										key={parking.id}
										className='flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200'
									>
										<span
											className={`grid size-14 shrink-0 place-items-center rounded-2xl bg-linear-to-br ${parking.accent} text-white`}
										>
											<CircleParking className='size-6' />
										</span>
										<button
											type='button'
											onClick={() => {
												setSheet(null)
												selectParking(parking.id)
											}}
											className='min-w-0 flex-1 text-left'
										>
											<p className='truncate text-sm font-black text-slate-900'>
												{parking.name}
											</p>
											<p className='mt-1 text-[11px] text-slate-400'>
												{distance.toFixed(1)} km ·{' '}
												{formatUZS(parking.pricePerHour)}/soat
											</p>
											<p
												className={`mt-1 text-[11px] font-black ${parking.availableSpaces > 0 ? 'text-emerald-600' : 'text-rose-500'}`}
											>
												{parking.availableSpaces > 0
													? `${parking.availableSpaces} bo‘sh joy`
													: 'TO‘LA'}
											</p>
										</button>
										<Link
											href={`/parking/${parking.id}`}
											onClick={() => setSheet(null)}
											className='grid size-9 shrink-0 place-items-center rounded-xl bg-violet-50 text-violet-600'
										>
											<ChevronRight className='size-4' />
										</Link>
									</div>
								))
							: visiblePlaces.map(place => (
									<button
										key={place.id}
										type='button'
										onClick={() =>
											setSheet({ type: 'place', placeId: place.id })
										}
										className='flex w-full items-center gap-3 rounded-2xl bg-white p-3 text-left shadow-sm ring-1 ring-slate-200'
									>
										<span
											className={`grid size-14 shrink-0 place-items-center rounded-2xl bg-linear-to-br ${place.accent} text-white`}
										>
											<MapPin className='size-6' />
										</span>
										<span className='min-w-0 flex-1'>
											<span className='block truncate text-sm font-black text-slate-900'>
												{place.title}
											</span>
											<span className='mt-1 block truncate text-[11px] text-slate-400'>
												{place.subtitle} · {place.distanceKm.toFixed(1)} km
											</span>
										</span>
										<ChevronRight className='size-4 text-slate-300' />
									</button>
								))}
					</div>
				</BottomSheet>
			)}

			{sheet?.type === 'place' &&
				(() => {
					const place = PLACES.find(item => item.id === sheet.placeId)
					if (!place) return null
					const favorite = favoritePlaceIds.includes(place.id)
					const bars = [35, 42, 55, 68, 82, 74, 58, 40]
					return (
						<BottomSheet title={place.title} onClose={() => setSheet(null)}>
							<div className='overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200'>
								<div className={`h-32 bg-linear-to-br ${place.accent}`} />
								<div className='p-4'>
									<div className='flex items-start justify-between gap-3'>
										<div className='min-w-0'>
											<p className='text-xl font-black text-slate-950'>
												{place.title}
											</p>
											<p className='mt-1 flex items-center gap-2 text-xs text-slate-400'>
												<Star className='size-4 fill-amber-400 text-amber-400' />{' '}
												{place.rating} · {formatNumber(place.reviews)}{' '}
												sharh
											</p>
										</div>
										<button
											type='button'
											onClick={() => togglePlaceFavorite(place.id)}
											className={`inline-flex h-10 shrink-0 items-center gap-2 rounded-xl px-3 text-xs font-black transition active:scale-95 ${
												favorite
													? 'bg-rose-50 text-rose-600'
													: 'bg-slate-100 text-slate-600'
											}`}
											aria-label={
												favorite
													? `${place.title}ni sevimlilardan olib tashlash`
													: `${place.title}ni sevimlilarga qo‘shish`
											}
										>
											<Heart
												className={`size-4 ${favorite ? 'fill-rose-500 text-rose-500' : 'text-slate-500'}`}
											/>
											{favorite ? 'Sevimlilarda' : 'Sevimlilarga'}
										</button>
									</div>
									<p className='mt-3 flex items-center gap-2 text-xs text-slate-500'>
										<MapPin className='size-4 shrink-0' /> {place.address}
									</p>
									<p className='mt-2 flex items-center gap-2 text-xs text-slate-500'>
										<Clock3 className='size-4 shrink-0' /> {place.subtitle}
									</p>
								</div>
							</div>

							<div className='mt-3 grid grid-cols-3 gap-2'>
								<div className='rounded-2xl bg-white p-3 text-center shadow-sm ring-1 ring-slate-200'>
									<Navigation className='mx-auto size-4 text-violet-600' />
									<p className='mt-2 text-lg font-black text-slate-950'>
										{Math.max(3, Math.round(place.distanceKm * 5))} daq
									</p>
									<p className='text-[10px] text-slate-400'>
										{place.distanceKm.toFixed(1)} km
									</p>
								</div>
								<div className='rounded-2xl bg-white p-3 text-center shadow-sm ring-1 ring-slate-200'>
									<CircleParking className='mx-auto size-4 text-violet-600' />
									<p className='mt-2 text-lg font-black text-emerald-600'>
										{place.free ?? '—'}
									</p>
									<p className='text-[10px] text-slate-400'>
										{place.total ? `${place.total} tadan` : 'parking'}
									</p>
								</div>
								<div className='rounded-2xl bg-white p-3 text-center shadow-sm ring-1 ring-slate-200'>
									<History className='mx-auto size-4 text-violet-600' />
									<p className='mt-2 text-lg font-black text-slate-950'>
										{place.queue ? `${place.queue} m` : '—'}
									</p>
									<p className='text-[10px] text-slate-400'>navbat</p>
								</div>
							</div>

							<div className='mt-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200'>
								<div className='flex items-center justify-between'>
									<p className='text-sm font-black text-slate-900'>
										Hozirgi yuklama
									</p>
									<p className='text-sm font-black text-orange-500'>
										{place.busy}%
									</p>
								</div>
								<div className='mt-2 h-2 overflow-hidden rounded-full bg-slate-100'>
									<div
										className='h-full rounded-full bg-orange-500'
										style={{ width: `${place.busy}%` }}
									/>
								</div>
								<div className='mt-4 flex h-16 items-end gap-2'>
									{bars.map((height, index) => (
										<div
											key={`${height}-${index}`}
											className='flex flex-1 flex-col items-center justify-end gap-1'
										>
											<span
												className='w-full rounded-t-md bg-violet-500'
												style={{ height: `${height}%` }}
											/>
											<span className='text-[8px] text-slate-400'>
												{10 + index * 2}
											</span>
										</div>
									))}
								</div>
							</div>

							<HorizontalRail className='mt-3 gap-2'>
								{place.tags.map(tag => (
									<span
										key={tag}
										className='inline-flex h-9 shrink-0 items-center rounded-xl bg-white px-3 text-xs font-bold text-slate-600 shadow-sm ring-1 ring-slate-200'
									>
										{tag}
									</span>
								))}
							</HorizontalRail>

							<div className='mt-3 grid grid-cols-4 gap-2'>
								<button
									type='button'
									onClick={() => {
										if (place.parkingId)
											router.push(`/navigate/parking/${place.parkingId}`)
										else showToast('Marshrut tayyorlandi')
									}}
									className='flex flex-col items-center gap-2 rounded-2xl bg-white p-3 text-[10px] font-bold text-slate-600 shadow-sm ring-1 ring-slate-200'
								>
									<Navigation className='size-5 text-violet-600' /> Yo‘nalish
								</button>
								<a
									href={`tel:${place.phone.replace(/\s/g, '')}`}
									className='flex flex-col items-center gap-2 rounded-2xl bg-white p-3 text-[10px] font-bold text-slate-600 shadow-sm ring-1 ring-slate-200'
								>
									<Phone className='size-5 text-violet-600' /> Qo‘ng‘iroq
								</a>
								<button
									type='button'
									onClick={() => sharePlace(place)}
									className='flex flex-col items-center gap-2 rounded-2xl bg-white p-3 text-[10px] font-bold text-slate-600 shadow-sm ring-1 ring-slate-200'
								>
									<Share2 className='size-5 text-violet-600' /> Ulashish
								</button>
								<button
									type='button'
									onClick={() => {
										if (place.parkingId) {
											setSheet(null)
											selectParking(place.parkingId)
										} else showToast('Xaritada ko‘rsatildi')
									}}
									className='flex flex-col items-center gap-2 rounded-2xl bg-white p-3 text-[10px] font-bold text-slate-600 shadow-sm ring-1 ring-slate-200'
								>
									<MapPin className='size-5 text-violet-600' /> Xaritada
								</button>
							</div>

							<button
								type='button'
								onClick={() => {
									if (place.parkingId) openParkingBooking(place.parkingId)
									else openService('table')
								}}
								className='mt-4 h-12 w-full rounded-2xl bg-violet-600 text-sm font-black text-white'
							>
								{place.parkingId
									? 'Yaqin parkingni bron qilish'
									: 'Bron qilish'}
							</button>
						</BottomSheet>
					)
				})()}

			<ParkingBookingSheet
				parkingId={bookingParkingId}
				onClose={() => setBookingParkingId(null)}
				onNotify={showToast}
			/>

			{sheet?.type === 'servicesAll' && (
				<BottomSheet title='Barcha xizmatlar' onClose={() => setSheet(null)}>
					<div className='flex flex-col gap-2'>
						{SERVICES.map(service => {
							const Icon = service.icon
							return (
								<button
									key={service.id}
									type='button'
									onClick={() => openService(service.id)}
									className='flex w-full items-center gap-3 rounded-2xl bg-white p-3 text-left shadow-sm'
								>
									<span className='grid size-11 shrink-0 place-items-center rounded-xl bg-slate-50'>
										<Icon
											className={`size-5 ${service.tone}`}
											strokeWidth={1.8}
										/>
									</span>
									<span className='min-w-0 flex-1'>
										<span className='block text-sm font-bold text-slate-900'>
											{service.label}
										</span>
										<span className='mt-0.5 block text-xs text-slate-400'>
											{service.subtitle}
										</span>
									</span>
									<ChevronRight className='size-4 shrink-0 text-slate-300' />
								</button>
							)
						})}
					</div>
				</BottomSheet>
			)}

			{sheet?.type === 'service' &&
				(() => {
					const service = SERVICES.find(item => item.id === sheet.serviceId)
					if (!service) return null
					const Icon = service.icon
					return (
						<BottomSheet title={service.label} onClose={() => setSheet(null)}>
							<div className='flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200'>
								<span className='grid size-11 shrink-0 place-items-center rounded-xl bg-violet-50'>
									<Icon className={`size-5 ${service.tone}`} />
								</span>
								<div>
									<p className='text-sm font-black text-slate-900'>
										{service.label}
									</p>
									<p className='mt-1 text-xs text-slate-400'>
										{service.subtitle}
									</p>
								</div>
							</div>
							<div className='mt-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200'>
								<p className='text-sm font-black text-slate-900'>Vaqt</p>
								<div className='mt-3 grid grid-cols-3 gap-2'>
									{BOOKING_SLOTS.map(slot => (
										<button
											key={slot}
											type='button'
											onClick={() => setBookingSlot(slot)}
											className={`h-10 rounded-xl text-xs font-black ${bookingSlot === slot ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-600'}`}
										>
											{slot}
										</button>
									))}
								</div>
							</div>
							{sheet.serviceId !== 'queue' && (
								<div className='mt-3 flex items-center justify-between rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200'>
									<span className='text-sm font-black text-slate-900'>
										Soni
									</span>
									<div className='flex items-center gap-3'>
										<button
											type='button'
											onClick={() =>
												setBookingCount(count => Math.max(1, count - 1))
											}
											className='grid size-9 place-items-center rounded-xl bg-slate-100 text-lg font-black'
										>
											−
										</button>
										<span className='w-6 text-center text-lg font-black'>
											{bookingCount}
										</span>
										<button
											type='button'
											onClick={() =>
												setBookingCount(count => Math.min(10, count + 1))
											}
											className='grid size-9 place-items-center rounded-xl bg-slate-100 text-lg font-black'
										>
											+
										</button>
									</div>
								</div>
							)}
							<button
								type='button'
								onClick={() => confirmService(service.id)}
								className='mt-4 h-12 w-full rounded-2xl bg-violet-600 text-sm font-black text-white'
							>
								Tasdiqlash
							</button>
						</BottomSheet>
					)
				})()}

			{sheet?.type === 'event' &&
				(() => {
					const event = EVENTS.find(item => item.id === sheet.eventId)
					if (!event) return null
					return (
						<BottomSheet title={event.title} onClose={() => setSheet(null)}>
							<div className='overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200'>
								<div className={`h-36 bg-linear-to-br ${event.accent} p-4`}>
									<span className='rounded-xl bg-white/90 px-3 py-1.5 text-[10px] font-black text-slate-800'>
										{event.category}
									</span>
								</div>
								<div className='p-4'>
									<p className='text-xl font-black text-slate-950'>
										{event.title}
									</p>
									<p className='mt-2 flex items-center gap-2 text-xs text-slate-500'>
										<Clock3 className='size-4' /> {event.when} · {event.time}
									</p>
									<p className='mt-2 flex items-center gap-2 text-xs text-slate-500'>
										<MapPin className='size-4' /> {event.place}
									</p>
									<p className='mt-3 text-xs leading-5 text-slate-600'>
										{event.description}
									</p>
								</div>
							</div>
							<div className='mt-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200'>
								<div className='flex items-center justify-between text-sm'>
									<span className='text-slate-500'>Narx</span>
									<strong>{event.price}</strong>
								</div>
								<div className='my-3 h-px bg-slate-100' />
								<div className='flex items-center justify-between text-sm'>
									<span className='text-slate-500'>Yaqin parking</span>
									<strong className='text-emerald-600'>mavjud</strong>
								</div>
							</div>
							<div className='mt-4 grid grid-cols-2 gap-2'>
								<button
									type='button'
									onClick={() => showToast('Eslatma qo‘shildi')}
									className='h-12 rounded-2xl border border-slate-200 bg-white text-sm font-black text-slate-700'
								>
									Eslatish
								</button>
								<button
									type='button'
									onClick={() => {
										setSheet(null)
										router.push(`/navigate/parking/${event.parkingId}`)
									}}
									className='h-12 rounded-2xl bg-violet-600 text-sm font-black text-white'
								>
									Marshrut va parking
								</button>
							</div>
						</BottomSheet>
					)
				})()}

			{sheet?.type === 'events' && (
				<BottomSheet title='Shahardagi voqealar' onClose={() => setSheet(null)}>
					<div className='space-y-3'>
						{EVENTS.map(event => (
							<button
								key={event.id}
								type='button'
								onClick={() => setSheet({ type: 'event', eventId: event.id })}
								className='w-full overflow-hidden rounded-2xl bg-white text-left shadow-sm ring-1 ring-slate-200'
							>
								<div className={`h-24 bg-linear-to-br ${event.accent} p-3`}>
									<span className='rounded-lg bg-white/90 px-2 py-1 text-[10px] font-black text-slate-800'>
										{event.when} · {event.time}
									</span>
								</div>
								<div className='p-3'>
									<p className='text-sm font-black text-slate-900'>
										{event.title}
									</p>
									<p className='mt-1 text-xs text-slate-400'>
										{event.place} · {event.price}
									</p>
								</div>
							</button>
						))}
					</div>
				</BottomSheet>
			)}

			{sheet?.type === 'recommendations' && (
				<BottomSheet title='Siz uchun tanlandi' onClose={() => setSheet(null)}>
					<p className='mb-3 text-xs leading-5 text-slate-500'>
						Safarlar, vaqt va parking mavjudligi asosidagi tezkor tavsiyalar.
					</p>
					<div className='space-y-2'>
						{AI_TIPS.map((tip, index) => (
							<button
								key={tip.title}
								type='button'
								onClick={() => {
									setAiIndex(index)
									setSheet(null)
									showToast(tip.title)
								}}
								className='flex w-full items-center gap-3 rounded-2xl bg-white p-4 text-left shadow-sm ring-1 ring-slate-200'
							>
								<span className='grid size-10 shrink-0 place-items-center rounded-xl bg-violet-50 text-violet-600'>
									<Sparkles className='size-5' />
								</span>
								<span className='min-w-0 flex-1'>
									<span className='block text-sm font-black text-slate-900'>
										{tip.title}
									</span>
									<span className='mt-1 block text-xs leading-5 text-slate-400'>
										{tip.text}
									</span>
								</span>
								<ChevronRight className='size-4 text-slate-300' />
							</button>
						))}
					</div>
				</BottomSheet>
			)}

			{/* Toast */}
			<Toast open={toast.open} message={toast.payload ?? ''} />
		</div>
	)
}
