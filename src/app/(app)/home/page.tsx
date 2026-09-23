'use client'

import {
	Bell,
	CalendarDays,
	Check,
	ChevronDown,
	ChevronRight,
	CircleParking,
	Clock3,
	Heart,
	History,
	Layers,
	LocateFixed,
	MapPin,
	Mic,
	Navigation,
	Phone,
	Search,
	Share2,
	Sparkles,
	Star,
	Sun,
	Ticket,
	Users,
	WandSparkles,
	X,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useMemo, useRef, useState } from 'react'

import { BottomSheet } from '@/components/ui/bottom-sheet'
import { Switch } from '@/components/ui/switch'
import { LoadingScreen } from '@/components/ui/loading-screen'
import { Toast } from '@/components/ui/toast'
import { HorizontalRail } from '@/components/ui/horizontal-rail'
import { CityMap } from '@/components/map/city-map'
import { SelectedParkingCard } from '@/components/map/selected-parking-card'
import { DestinationSheet } from '@/components/transport/destination-sheet'
import { ServiceBookingSheet } from '@/components/booking/service-booking-sheet'
import { TableBookingFlow } from '@/components/booking/table-booking-flow'
import { ParkingBookingSheet } from '@/components/parking/parking-booking-sheet'
import { TakeTicketSheet } from '@/components/queues/take-ticket-sheet'
import { useApp } from '@/context/app-context'
import { useMapLayers } from '@/hooks/use-map-layers'
import { useDirections } from '@/hooks/use-directions'
import { usePlaceFavorites } from '@/hooks/use-place-favorites'
import { useToast } from '@/hooks/use-toast'
import { CITY_META } from '@/data/city-meta'
import { PARKINGS } from '@/data/parkings'
import { EVENTS } from '@/data/events'
import { PLACES } from '@/data/places'
import { getQueueOrg, getQueueOrgByPlace } from '@/data/queue-orgs'
import { formatNumber, formatUZS } from '@/lib/format'
import type { Place, PlaceCategory, ServiceBookingKind } from '@/lib/types'
import { distanceKm } from '@/lib/geo'
import {
	AI_TIPS,
	CATEGORIES,
	SERVICES,
} from '@/data/home-content'
import {
	findAddresses,
	highlightParts,
	locationMessage,
	searchMatches,
} from '@/lib/search'
import { buildHomeMapObjects, HOME_BIKE_LINES } from '@/lib/home-map'
import { useRefreshSignal } from '@/components/ui/pull-to-refresh'
import { liveAvailabilityAll } from '@/lib/live-availability'
import { MAP_LAYERS, activeLayerCount } from '@/lib/map-layers'
import { destinationIdFrom, type DestinationSource } from '@/lib/navigation'
import { originLabel } from '@/lib/transport'
import { useUserLocation } from '@/lib/use-user-location'

type SortMode = 'distance' | 'rating' | 'free'
type SheetState =
	| { type: 'city' }
	| { type: 'weather' }
	| { type: 'history' }
	| { type: 'sort' }
	| { type: 'categories' }
	| { type: 'nearby' }
	| { type: 'place'; placeId: string }
	| { type: 'servicesAll' }
	| { type: 'event'; eventId: string }
	| { type: 'events' }
	| { type: 'recommendations' }
	| { type: 'layers' }
	| { type: 'destination' }
	| null

export default function HomePage() {
	return (
		<Suspense fallback={<LoadingScreen />}>
			<HomeRoute />
		</Suspense>
	)
}

function HomeRoute() {
	const params = useSearchParams()
	return <HomeView key={params.toString()} />
}

function HomeView() {
	const router = useRouter()
	const {
		user,
		reservations,
		favorites,
		toggleFavorite,
		favoriteEvents,
		toggleEventFavorite,
		unreadCount,
	} = useApp()
	const { location, status, error: locationError, locate } = useUserLocation()

	const [selectedCity, setSelectedCity] = useState('Toshkent')
	const [selectedParkingId, setSelectedParkingId] = useState<string | null>(
		null,
	)
	// What «Yo‘nalish» on the map would route to, as a route endpoint id.
	// Null until the customer selects something: the strip that used to sit
	// here offered four travel times belonging to no destination at all, and
	// choosing how to travel belongs on /transport, after the destination.
	const [destinationId, setDestinationId] = useState<string | null>(null)
	const directions = useDirections()
	const [activeCategory, setActiveCategory] = useState<PlaceCategory>('all')
	const [sortMode, setSortMode] = useState<SortMode>('distance')
	const [favoriteOnly, setFavoriteOnly] = useState(false)
	const placeFavorites = usePlaceFavorites()
	const { layers, toggle: toggleLayer } = useMapLayers()
	const { tick } = useRefreshSignal()
	const liveParkings = useMemo(() => liveAvailabilityAll(PARKINGS, tick), [tick])
	const [locateRevision, setLocateRevision] = useState(0)
	const favoritePlaceIds = placeFavorites.ids
	// /map's "Ochish" on a place lands here with its detail sheet open.
	const requestedPlace = useSearchParams().get('place')
	const requestedEvent = useSearchParams().get('event')
	const [sheet, setSheet] = useState<SheetState>(
		requestedPlace && PLACES.some(place => place.id === requestedPlace)
			? { type: 'place', placeId: requestedPlace }
			: requestedEvent && EVENTS.some(event => event.id === requestedEvent)
				? { type: 'event', eventId: requestedEvent } : null,
	)
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
	const [serviceBooking, setServiceBooking] = useState<{
		kind: ServiceBookingKind
		refId: string
	} | null>(null)
	const [bookingParkingId, setBookingParkingId] = useState<string | null>(
		null,
	)
	// The queue desk of the venue whose sheet is open, once the user asks for
	// a number. Held by organisation id so the sheet always belongs to the
	// place that was actually opened.
	const [queueOrgId, setQueueOrgId] = useState<string | null>(null)
	// The generic «Stol bron qilish», which has to ask which restaurant first.
	const [tableFlowOpen, setTableFlowOpen] = useState(false)
	const [updatedLabel, setUpdatedLabel] = useState('hozirgina')

	const voiceTimer = useRef<number | null>(null)
	const voiceDoneTimer = useRef<number | null>(null)
	const nearbyRef = useRef<HTMLElement>(null)

	const cities = useMemo(
		() => Array.from(new Set(PARKINGS.map(parking => parking.city))),
		[],
	)

	const parkingResults = useMemo(() => {
		let list = liveParkings.filter(parking => parking.city === selectedCity)
			.filter(parking => !favoriteOnly || favorites.includes(parking.id))
			.map(parking => ({ parking, distance: distanceKm(location, parking) }))

		if (sortMode === 'free') {
			list = [...list].sort(
				(a, b) => b.parking.availableSpaces - a.parking.availableSpaces,
			)
		} else if (sortMode === 'rating') {
			list = [...list].sort(
				(a, b) => b.parking.rating - a.parking.rating,
			)
		} else {
			list = [...list].sort((a, b) => a.distance - b.distance)
		}

		return list
	}, [favorites, favoriteOnly, location, selectedCity, sortMode, liveParkings])

	const mapParkings = useMemo(
		() => parkingResults.map(({ parking }) => parking),
		[parkingResults],
	)

	// What the map is allowed to draw, per City Goo's layer switches. Places
	// always show (they are the category the user picked); the rest are opt-in.
	const mapObjects = useMemo(() => buildHomeMapObjects({
		parkings: mapParkings, origin: location, layers, city: selectedCity,
		category: activeCategory, favoritePlaceIds: favoriteOnly ? favoritePlaceIds : undefined,
	}), [mapParkings, location, layers, selectedCity, activeCategory, favoriteOnly, favoritePlaceIds])

	const selectedParking = useMemo(
		() => layers.parking ? mapParkings.find(parking => parking.id === selectedParkingId) : undefined,
		[selectedParkingId, mapParkings, layers.parking],
	)

	// How the destination picker names the customer's own position. The same
	// wording /transport uses, and never a claim of GPS there is no fix for.
	const originValue = originLabel(status)

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
		// Picking a lot on the map is picking where you are going, so the
		// transport strip follows it instead of quietly keeping the old target.
		setDestinationId(`parking:${parkingId}`)
		window.setTimeout(() => {
			document
				.getElementById('parking-map')
				?.scrollIntoView({ behavior: 'smooth', block: 'center' })
		}, 60)
	}

	function openDestinationPicker() {
		setSheet({ type: 'destination' })
	}

	function closeDestinationPicker() {
		setSheet(null)
	}

	// Every «Yo‘nalish» on this screen goes through here: resolve the thing
	// the customer is looking at, then open /transport on it directly.
	// Nothing opens on a stand-in — an unresolvable reference says so.
	function routeTo(source: DestinationSource) {
		setSheet(null)
		const id = destinationIdFrom(source)
		if (!id) return showToast('Bu joy uchun manzil topilmadi')
		setDestinationId(id)
		directions.openId(id)
	}

	// Home's own "where are you going?" — the generic way in, for when the
	// customer has not opened a place first.
	function chooseDestination(id: string) {
		setDestinationId(id)
		closeDestinationPicker()
		directions.openId(id)
	}

	function chooseCategory(id: PlaceCategory | 'transport' | 'queues' | 'more') {
		if (id === 'more') {
			setSheet({ type: 'categories' })
			return
		}
		if (id === 'transport') {
			router.push('/transport')
			return
		}
		if (id === 'parking') {
			router.push('/parking')
			return
		}
		if (id === 'queues') {
			router.push('/queues')
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

	// The two things a venue itself can be booked for. Both take the place the
	// user opened — never a fixed demo venue — and both hand over to the
	// components /queues and the Bron tab already use.
	function openPlaceQueue(placeId: string) {
		const org = getQueueOrgByPlace(placeId)
		if (!org) {
			showToast('Bu joyda elektron navbat yo‘q')
			return
		}
		setSheet(null)
		setQueueOrgId(org.id)
	}

	function openTableBooking(placeId: string) {
		if (!PLACES.some(place => place.id === placeId)) {
			showToast('Joy topilmadi')
			return
		}
		setSheet(null)
		setServiceBooking({ kind: 'table', refId: placeId })
	}

	function openService(serviceId: string) {
		if (serviceId === 'queue') {
			router.push('/queues')
			return
		}
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
		if (serviceId === 'table') {
			// No restaurant in context here, so ask which one rather than
			// booking whichever venue the code happened to name.
			setSheet(null)
			setTableFlowOpen(true)
			return
		}
		// cinema / clinic. These used to open a slot picker that ended in a
		// toast and stored nothing, so the booking never existed.
		const venue = serviceId === 'cinema' ? 'cinema-magic' : 'medical-plaza'
		setSheet(null)
		setServiceBooking({ kind: serviceId as ServiceBookingKind, refId: venue })
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
	// Streets, derived from the catalogs rather than hardcoded, so the group
	// can only ever offer somewhere the app can actually route to.
	const searchAddresses = searchLower
		? findAddresses(searchLower, [
				...PLACES.map(place => ({
					address: place.address,
					parkingId: place.parkingId,
				})),
				...PARKINGS.map(parking => ({
					address: parking.address,
					parkingId: parking.id,
				})),
			])
		: []
	const searchTotal =
		searchParkings.length +
		searchPlaces.length +
		searchServices.length +
		searchEvents.length +
		searchAddresses.length

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
						<LocateFixed className='size-5 shrink-0 text-brand' />
						<span className='truncate text-lg font-black tracking-tight text-ink'>
							{selectedCity}
						</span>
						<ChevronDown className='size-4 shrink-0 text-ink-3' />
					</button>

					<div className='flex items-center gap-2'>
						<button
							type='button'
							onClick={() => setSheet({ type: 'weather' })}
							className='inline-flex h-10 items-center gap-2 rounded-xl bg-warn-bg px-3 text-sm font-black text-warn'
						>
							<Sun className='size-5' />
							{meta.temp}°
						</button>
						<Link
							href='/notifications'
							className='relative grid size-10 place-items-center rounded-xl bg-white text-ink-2 shadow-card'
							aria-label='Bildirishnomalar'
						>
							<Bell className='size-5' />
							{unreadCount > 0 && (
								<span className='absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-bad px-1 text-[10px] font-black leading-5 text-white'>
									{Math.min(unreadCount, 9)}
								</span>
							)}
						</Link>
					</div>
				</div>

				<h1 className='sr-only'>B SPACE · {selectedCity}</h1>

				<div className='flex h-14 w-full items-center gap-2 rounded-2xl bg-white px-3 shadow-card'>
					<button
						type='button'
						onClick={openSearch}
						className='flex min-w-0 flex-1 items-center gap-3 text-left'
					>
						<Search className='size-5 shrink-0 text-ink-3' />
						<span className='min-w-0 flex-1 truncate text-sm text-ink-3'>
							Joy, xizmat yoki manzil qidiring…
						</span>
					</button>
					<button
						type='button'
						onClick={startVoice}
						className='grid size-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand'
						aria-label='Ovozli qidiruv'
					>
						<Mic className='size-4' />
					</button>
				</div>

				{/* The «Uy · 18 daq» / «Ish · 22 daq» chips that used to lead this
				    rail were a fabricated address book with fabricated commute
				    times, shown to a customer who had saved neither address. What
				    is left is the customer's own: their favourites and their
				    history, both of which start empty. */}
				<HorizontalRail className='gap-2'>
					<button
						type='button'
						onClick={() => setFavoriteOnly(value => !value)}
						className={`inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border px-3 text-xs font-bold ${
							favoriteOnly
								? 'border-brand bg-brand text-white'
								: 'border-line bg-white text-ink-2'
						}`}
					>
						<Heart className='size-4' />
						Sevimlilar · {favorites.length + favoritePlaceIds.length}
					</button>
					<button
						type='button'
						onClick={() => setSheet({ type: 'history' })}
						className='inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border border-line bg-white px-3 text-xs font-bold text-ink-2'
					>
						<History className='size-4 text-ink-3' />
						Tarix
					</button>
				</HorizontalRail>
			</section>

			{/* Map + transport strip */}
			<section className='overflow-hidden rounded-3xl bg-white shadow-card'>
				<div id='parking-map' className='relative scroll-mt-4'>
					<CityMap
						objects={mapObjects}
						selectedKey={
							selectedParkingId ? `parking:${selectedParkingId}` : null
						}
						onSelect={object => {
							if (object.kind === 'parking') selectParking(object.id)
							else if (object.kind === 'place') setSheet({ type: 'place', placeId: object.id })
							else if (object.kind === 'event') setSheet({ type: 'event', eventId: object.id })
							else router.push(object.href)
						}}
						lines={layers.bike && selectedCity === 'Toshkent' ? HOME_BIKE_LINES : undefined}
						viewportKey={`${selectedCity}:${activeCategory}:${favoriteOnly}`}
						locateRevision={locateRevision}
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
								setLocateRevision(value => value + 1)
								showToast('Joylashuvingiz yangilanmoqda')
							}}
							className='citygo-pressable grid size-9 place-items-center rounded-xl bg-white text-brand shadow-card'
							aria-label='Joylashuvim'
						>
							<LocateFixed
								className={`size-4 ${status === 'loading' ? 'citygo-refresh-spinner is-refreshing' : ''}`}
							/>
						</button>
						<button
							type='button'
							onClick={() => setSheet({ type: 'layers' })}
							className='relative grid size-9 place-items-center rounded-xl bg-white text-ink-2 shadow-card'
							aria-label='Xarita qatlamlari'
						>
							<Layers className='size-4' />
							<span className='absolute -right-1 -top-1 grid min-w-4 place-items-center rounded-full bg-brand px-1 text-[9px] font-black leading-4 text-white'>
								{activeLayerCount(layers)}
							</span>
						</button>
					</div>

					{layers.eco && (
						<div className='absolute right-3 top-3 z-20 rounded-xl bg-white/95 px-2.5 py-1.5 shadow-md'>
							<p className='text-[10px] font-semibold text-ink-3'>AQI · namuna</p>
							<p className='text-[13px] font-black text-ok'>
								32 · Yaxshi
							</p>
						</div>
					)}

					{selectedParking && (
						<SelectedParkingCard
							parking={selectedParking}
							onClose={() => setSelectedParkingId(null)}
							className='absolute inset-x-3 bottom-14'
						/>
					)}

					<div className='pointer-events-none absolute inset-x-3 bottom-3 z-20 flex items-center justify-between gap-2'>
						<button
							type='button'
							onClick={() => {
								// Directions to whatever is actually selected on the map,
								// and a question when nothing is. This used to fall
								// through to whichever lot happened to sort first.
								if (!destinationId) return openDestinationPicker()
								directions.openId(destinationId)
							}}
							className='pointer-events-auto inline-flex h-9 items-center gap-2 rounded-xl bg-brand px-3 text-xs font-black text-white shadow-lg shadow-[0_6px_16px_rgb(108_71_224/.28)]'
						>
							<Navigation className='size-4' />
							Yo‘nalish
						</button>
						<button
							type='button'
							onClick={() => router.push('/map')}
							className='pointer-events-auto inline-flex h-9 items-center gap-2 rounded-xl bg-white px-3 text-xs font-black text-ink shadow-card'
						>
							<Layers className='size-4 text-brand' />
							Butun xarita
						</button>
					</div>
				</div>
			</section>

			{status === 'fallback' && (
				<p className='rounded-2xl bg-warn-bg p-3 text-xs leading-5 text-warn'>
					{locationMessage(locationError)}
				</p>
			)}

			{/* Existing B SPACE active-session capability preserved */}
			{activeReservation && (
				<Link
					href={`/reservation/${activeReservation.id}`}
					className='flex items-center justify-between gap-3 rounded-2xl bg-ok p-4 text-white shadow-lg shadow-[0_8px_24px_rgb(18_183_106/.22)]'
				>
					<div>
						<p className='text-[10px] font-black uppercase tracking-[.18em] text-ok-bg'>
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
					<h2 className='text-lg font-black tracking-tight text-ink'>
						Kategoriyalar
					</h2>
					<button
						type='button'
						onClick={() => setSheet({ type: 'categories' })}
						className='inline-flex items-center gap-1 text-xs font-black text-brand'
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
									className={`grid size-12 place-items-center rounded-2xl ${category.tone} ${selected ? 'ring-2 ring-brand ring-offset-2' : ''}`}
								>
									<Icon className='size-5' />
								</span>
								<span
									className={`text-[10px] font-bold leading-3 ${selected ? 'text-brand-600' : 'text-ink-2'}`}
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
						<h2 className='truncate text-lg font-black tracking-tight text-ink'>
							{nearbyTitle}
						</h2>
						<span className='rounded-lg bg-card-2 px-2 py-1 text-[10px] font-black text-ink-3'>
							{nearbyCount}
						</span>
					</div>
					<button
						type='button'
						onClick={() => setSheet({ type: 'sort' })}
						className='shrink-0 text-xs font-black text-brand'
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
										className='w-44.5 shrink-0 overflow-hidden rounded-2xl bg-white shadow-card'
									>
										<div
											className={`relative h-24 bg-linear-to-br ${parking.accent} p-3 text-white`}
										>
											<button
												type='button'
												onClick={() => toggleFavorite(parking.id)}
												className='absolute right-2 top-2 grid size-8 place-items-center rounded-full bg-white/90 text-ink-2 shadow-sm'
												aria-label='Sevimlilar'
											>
												<Heart
													className={`size-4 ${favorite ? 'fill-bad text-bad' : ''}`}
												/>
											</button>
											<span className='absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-lg bg-white/90 px-2 py-1 text-[10px] font-black text-ink'>
												<Star className='size-3 fill-star text-star' />
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
												<h3 className='truncate text-sm font-black text-ink'>
													{parking.name}
												</h3>
												<p className='mt-1 truncate text-[11px] text-ink-3'>
													{parking.district} · {parking.city}
												</p>
											</button>
											<div className='mt-3 flex items-center justify-between gap-2 text-[10px] font-bold'>
												<span className='text-ink-3'>
													{distance.toFixed(1)} km
												</span>
												<span
													className={
														parking.availableSpaces === 0
															? 'text-bad'
															: parking.availableSpaces <= 5
																? 'text-warn'
																: 'text-ok'
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
													className='inline-flex h-9 items-center justify-center rounded-xl border border-brand-100 text-[10px] font-black text-brand-600'
												>
													Xarita
												</button>
												{parking.availableSpaces > 0 ? (
													<button
														type='button'
														onClick={() => openParkingBooking(parking.id)}
														className='inline-flex h-9 items-center justify-center rounded-xl bg-brand text-[10px] font-black text-white'
													>
														Bron
													</button>
												) : (
													<Link
														href={`/parking/${parking.id}`}
														className='inline-flex h-9 items-center justify-center rounded-xl bg-brand text-[10px] font-black text-white'
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
								className='flex w-29.5 shrink-0 flex-col items-center justify-center gap-2 rounded-2xl bg-white px-3 text-center shadow-card'
							>
								<ChevronRight className='size-5 text-brand' />
								<span className='text-xs font-black text-brand-600'>
									Barchasini ko‘rish
								</span>
							</button>
						</HorizontalRail>
					) : (
						<div className='rounded-2xl border border-dashed border-line-2 p-7 text-center text-sm text-ink-3'>
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
									className='w-44 shrink-0 cursor-pointer overflow-hidden rounded-2xl bg-white shadow-card transition active:scale-[0.985]'
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
											className='absolute right-2 top-2 z-10 grid size-8 place-items-center rounded-full bg-white/90 text-ink-2 shadow-sm transition active:scale-95'
											aria-label={
												favorite
													? `${place.title}ni sevimlilardan olib tashlash`
													: `${place.title}ni sevimlilarga qo‘shish`
											}
										>
											<Heart
												className={`size-4 ${favorite ? 'fill-bad text-bad' : ''}`}
											/>
										</button>
										<span className='absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-lg bg-white/90 px-2 py-1 text-[10px] font-black text-ink'>
											<Star className='size-3 fill-star text-star' />{' '}
											{place.rating}
										</span>
									</div>
									<div className='w-full p-3 text-left'>
										<h3 className='truncate text-sm font-black text-ink'>
											{place.title}
										</h3>
										<p className='mt-1 truncate text-[11px] text-ink-3'>
											{place.subtitle}
										</p>
										<div className='mt-3 flex items-center gap-3 text-[10px] font-bold'>
											<span className='text-ink-3'>
												{place.distanceKm.toFixed(1)} km
											</span>
											{place.free !== undefined && (
												<span className='text-ok'>
													{place.free} joy
												</span>
											)}
											{place.queue !== undefined && (
												<span className='text-ink-2'>
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
							className='flex w-29.5 shrink-0 flex-col items-center justify-center gap-2 rounded-2xl bg-white px-3 text-center shadow-card'
						>
							<ChevronRight className='size-5 text-brand' />
							<span className='text-xs font-black text-brand-600'>
								Barchasini ko‘rish
							</span>
						</button>
					</HorizontalRail>
				) : (
					<div className='rounded-2xl border border-dashed border-line-2 p-7 text-center text-sm text-ink-3'>
						Bu kategoriyada sevimli joy topilmadi.
					</div>
				)}
			</section>

			{/* Services — CITY GO layout */}
			<section>
				<div className='mb-2 flex items-baseline justify-between gap-3'>
					<h2 className='text-lg font-[750] tracking-[-0.3px] text-ink'>
						Mashhur xizmatlar
					</h2>
					<button
						type='button'
						onClick={() => setSheet({ type: 'servicesAll' })}
						className='inline-flex shrink-0 items-center gap-1 text-[13px] font-semibold text-brand'
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
									className='inline-flex shrink-0 items-center gap-2.5 rounded-[18px] bg-white px-3.5 py-3 text-[13px] font-semibold text-ink-2 shadow-card'
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
			<section className='overflow-hidden rounded-3xl bg-linear-[130deg,#6c47e0,#4c2fb0] p-5 text-white shadow-xl shadow-[0_8px_24px_rgb(108_71_224/.22)]'>
				<div className='flex items-start justify-between gap-3'>
					<div>
						<p className='text-lg font-black'>
							Siz uchun, {user?.name ?? 'B SPACE'}
						</p>
						<p className='mt-1 text-xs leading-5 text-brand-100'>
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
						<p className='text-[10px] font-bold text-brand-100'>
							BUGUN · 19:00
						</p>
						<p className='mt-1 truncate text-base font-black'>
							{EVENTS[0].title}
						</p>
						<p className='mt-2 text-xs text-brand-100'>
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
					<h2 className='text-lg font-black tracking-tight text-ink'>
						Shahardagi voqealar
					</h2>
					<button
						type='button'
						onClick={() => setSheet({ type: 'events' })}
						className='text-xs font-black text-brand'
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
							className='w-40 shrink-0 overflow-hidden rounded-2xl bg-white text-left shadow-card'
						>
							<div className={`h-24 bg-linear-to-br ${event.accent} p-3`}>
								<span className='rounded-lg bg-white/90 px-2 py-1 text-[10px] font-black text-ink'>
									{event.when}
								</span>
							</div>
							<div className='p-3'>
								<p className='text-[10px] font-bold text-ink-3'>
									{event.time} · {event.category}
								</p>
								<p className='mt-1 truncate text-sm font-black text-ink'>
									{event.title}
								</p>
								<p className='mt-2 truncate text-[10px] text-ink-3'>
									{event.place}
								</p>
							</div>
						</button>
					))}
				</HorizontalRail>
			</section>

			{/* AI recommendation */}
			<section key={aiIndex} className='animate-fade-up rounded-card-lg border border-brand-100 bg-brand-50 p-4'>
				<div className='flex gap-3'>
					<span className='grid size-10 shrink-0 place-items-center rounded-xl bg-brand text-white'>
						<WandSparkles className='size-5' />
					</span>
					<div className='min-w-0 flex-1'>
						<div className='flex items-center justify-between gap-2'>
							<span className='inline-flex items-center gap-1 text-xs font-black text-brand-600'>
								<Sparkles className='size-3.5' /> AI tavsiya
							</span>
							<button
								type='button'
								onClick={() =>
									setAiIndex(index => (index + 1) % AI_TIPS.length)
								}
								className='inline-flex items-center gap-1 text-[10px] font-bold text-ink-3'
							>
								{aiIndex + 1}/{AI_TIPS.length}{' '}
								<History className='size-3.5 text-brand' />
							</button>
						</div>
						<p className='mt-2 text-sm font-black text-ink'>
							{aiTip.title}
						</p>
						<p className='mt-1 text-xs leading-5 text-ink-3'>
							{aiTip.text}
						</p>
						<button
							type='button'
							onClick={() => {
								if (aiIndex === 1) openParkingBooking(aiTip.parkingId)
								else if (aiIndex === 2) routeTo({ from: 'parking', parkingId: aiTip.parkingId })
								else selectParking(aiTip.parkingId)
							}}
							className='mt-3 inline-flex h-9 items-center gap-2 rounded-xl bg-brand px-3 text-xs font-black text-white'
						>
							<CircleParking className='size-4' /> {aiTip.action}
						</button>
					</div>
				</div>
			</section>

			<button
				type='button'
				onClick={refreshHome}
				className='flex w-full items-center justify-center gap-2 px-1 text-[10px] font-semibold text-ink-3'
			>
				<History className='size-3.5' /> Ma’lumotlar {updatedLabel} yangilandi ·
				yangilash uchun bosing
			</button>

			{/* SEARCH OVERLAY */}
			{searchOpen && (
				<section className='fixed inset-x-0 top-0 z-90 mx-auto flex h-dvh w-full max-w-md flex-col bg-canvas'>
					<div className='flex items-center gap-2 px-4 pb-3 pt-[max(1rem,env(safe-area-inset-top))]'>
						<button
							type='button'
							onClick={() => setSearchOpen(false)}
							className='grid size-11 shrink-0 place-items-center rounded-xl bg-white text-ink-2 shadow-card'
						>
							<X className='size-5' />
						</button>
						<div className='flex h-12 min-w-0 flex-1 items-center gap-2 rounded-2xl bg-white px-3 shadow-card'>
							<Search className='size-5 shrink-0 text-ink-3' />
							<input
								autoFocus
								value={searchQuery}
								onChange={event => setSearchQuery(event.target.value)}
								className='min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-ink-3'
								placeholder='Joy, xizmat, parking…'
							/>
							{searchQuery && (
								<button
									type='button'
									onClick={() => setSearchQuery('')}
									className='grid size-7 place-items-center text-ink-3'
								>
									<X className='size-4' />
								</button>
							)}
							<button
								type='button'
								onClick={startVoice}
								className='grid size-8 place-items-center text-brand'
							>
								<Mic className='size-4' />
							</button>
						</div>
					</div>

					<div className='flex-1 overflow-y-auto px-4 pb-8'>
						{!searchQuery.trim() ? (
							<div className='space-y-5'>
								<div>
									<p className='mb-2 text-[11px] font-black uppercase tracking-[.14em] text-ink-3'>
										So‘nggi qidiruvlar
									</p>
									<div className='overflow-hidden rounded-2xl bg-white shadow-card'>
										{recentQueries.map((query, index) => (
											<button
												key={query}
												type='button'
												onClick={() => setSearchQuery(query)}
												className={`flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-semibold text-ink-2 ${index ? 'border-t border-line' : ''}`}
											>
												<History className='size-4 text-ink-3' />
												<span className='min-w-0 flex-1 truncate'>{query}</span>
												<ChevronRight className='size-4 text-ink-3' />
											</button>
										))}
									</div>
								</div>

								<div>
									<p className='mb-2 text-[11px] font-black uppercase tracking-[.14em] text-ink-3'>
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
												className='h-10 shrink-0 rounded-xl bg-white px-3 text-xs font-bold text-ink-2 shadow-card'
											>
												{query}
											</button>
										))}
									</HorizontalRail>
								</div>

								<div>
									<p className='mb-3 text-[11px] font-black uppercase tracking-[.14em] text-ink-3'>
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
													<span className='text-[10px] font-bold text-ink-2'>
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
										<p className='mb-2 text-[11px] font-black uppercase tracking-[.14em] text-ink-3'>
											Parking · {searchParkings.length}
										</p>
										<div className='overflow-hidden rounded-2xl bg-white shadow-card'>
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
													className={`flex w-full items-center gap-3 px-4 py-3 text-left ${index ? 'border-t border-line' : ''}`}
												>
													<span
														className={`grid size-10 shrink-0 place-items-center rounded-xl bg-linear-to-br ${parking.accent} text-white`}
													>
														<CircleParking className='size-5' />
													</span>
													<span className='min-w-0 flex-1'>
									<span className='block truncate text-sm font-black text-ink'>
										<Mark text={parking.name} query={searchQuery} />
									</span>
									<span className='mt-0.5 block truncate text-[11px] text-ink-3'>
										<Mark text={parking.address} query={searchQuery} />
									</span>
													</span>
													<span
														className={`text-[10px] font-black ${parking.availableSpaces > 0 ? 'text-ok' : 'text-bad'}`}
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
										<p className='mb-2 text-[11px] font-black uppercase tracking-[.14em] text-ink-3'>
											Joylar · {searchPlaces.length}
										</p>
										<div className='overflow-hidden rounded-2xl bg-white shadow-card'>
											{searchPlaces.map((place, index) => (
												<button
													key={place.id}
													type='button'
													onClick={() => {
														rememberQuery(searchQuery)
														setSearchOpen(false)
														setSheet({ type: 'place', placeId: place.id })
													}}
													className={`flex w-full items-center gap-3 px-4 py-3 text-left ${index ? 'border-t border-line' : ''}`}
												>
													<span
														className={`grid size-10 shrink-0 place-items-center rounded-xl bg-linear-to-br ${place.accent} text-white`}
													>
														<MapPin className='size-5' />
													</span>
													<span className='min-w-0 flex-1'>
									<span className='block truncate text-sm font-black text-ink'>
										<Mark text={place.title} query={searchQuery} />
									</span>
									<span className='mt-0.5 block truncate text-[11px] text-ink-3'>
										<Mark text={place.subtitle} query={searchQuery} />
									</span>
													</span>
													<Star className='size-4 fill-star text-star' />
												</button>
											))}
										</div>
									</div>
								)}

								{searchServices.length > 0 && (
									<div>
										<p className='mb-2 text-[11px] font-black uppercase tracking-[.14em] text-ink-3'>
											Xizmatlar · {searchServices.length}
										</p>
										<div className='overflow-hidden rounded-2xl bg-white shadow-card'>
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
														className={`flex w-full items-center gap-3 px-4 py-3 text-left ${index ? 'border-t border-line' : ''}`}
													>
														<span className='grid size-10 shrink-0 place-items-center rounded-xl bg-brand-50'>
															<Icon className={`size-5 ${service.tone}`} />
														</span>
														<span className='min-w-0 flex-1 text-sm font-black text-ink'>
															<Mark text={service.label} query={searchQuery} />
														</span>
														<ChevronRight className='size-4 text-ink-3' />
													</button>
												)
											})}
										</div>
									</div>
								)}

								{searchEvents.length > 0 && (
									<div>
										<p className='mb-2 text-[11px] font-black uppercase tracking-[.14em] text-ink-3'>
											Voqealar · {searchEvents.length}
										</p>
										<div className='overflow-hidden rounded-2xl bg-white shadow-card'>
											{searchEvents.map((event, index) => (
												<button
													key={event.id}
													type='button'
													onClick={() => {
														rememberQuery(searchQuery)
														setSearchOpen(false)
														setSheet({ type: 'event', eventId: event.id })
													}}
													className={`flex w-full items-center gap-3 px-4 py-3 text-left ${index ? 'border-t border-line' : ''}`}
												>
													<span className='grid size-10 shrink-0 place-items-center rounded-xl bg-brand-100 text-brand'>
														<Ticket className='size-5' />
													</span>
													<span className='min-w-0 flex-1'>
														<span className='block truncate text-sm font-black text-ink'>
															<Mark text={event.title} query={searchQuery} />
														</span>
														<span className='mt-0.5 block text-[11px] text-ink-3'>
															{event.when} · {event.time}
														</span>
													</span>
												</button>
											))}
										</div>
									</div>
								)}

								{searchAddresses.length > 0 && (
									<div>
										<p className='mb-2 text-[11px] font-black uppercase tracking-[.14em] text-ink-3'>
											Manzillar · {searchAddresses.length}
										</p>
										<div className='overflow-hidden rounded-2xl bg-white shadow-card'>
											{searchAddresses.map((hit, index) => (
												<button
													key={hit.street}
													type='button'
													onClick={() => {
														rememberQuery(searchQuery)
														setSearchOpen(false)
														routeTo({ from: 'parking', parkingId: hit.parkingId })
													}}
													className={`flex w-full items-center gap-3 px-4 py-3 text-left ${index ? 'border-t border-line' : ''}`}
												>
													<span className='grid size-10 shrink-0 place-items-center rounded-xl bg-card-2 text-ink-3'>
														<LocateFixed className='size-5' />
													</span>
													<span className='min-w-0 flex-1'>
														<span className='block truncate text-sm font-black text-ink'>
															<Mark text={hit.street} query={searchQuery} />
														</span>
														<span className='mt-0.5 block text-[11px] text-ink-3'>
															{hit.count} ta obyekt
														</span>
													</span>
													<Navigation className='size-4 text-brand' />
												</button>
											))}
										</div>
									</div>
								)}
							</div>
						) : (
							<div className='mt-10 rounded-3xl bg-white p-8 text-center shadow-card'>
								<Search className='mx-auto size-8 text-ink-3' />
								<p className='mt-3 text-sm font-black text-ink'>
									Hech narsa topilmadi
								</p>
								<p className='mt-2 text-xs leading-5 text-ink-3'>
									Qidiruvni qisqartirib yoki boshqa so‘z bilan sinab ko‘ring.
								</p>
								<button
									type='button'
									onClick={() => setSearchQuery('')}
									className='mt-4 h-10 rounded-xl border border-line px-4 text-xs font-black text-ink-2'
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
				<div className='fixed inset-x-0 top-0 z-100 mx-auto flex h-dvh w-full max-w-md flex-col items-center justify-center gap-6 bg-ink/75 px-8 text-center text-white backdrop-blur-md'>
					<div className='citygo-voice-ring grid size-28 place-items-center rounded-full bg-brand shadow-2xl shadow-[0_10px_30px_rgb(108_71_224/.3)]'>
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
					<p className='mb-3 text-xs leading-5 text-ink-3'>
						Parkinglar, masofalar va shahar ma’lumotlari tanlangan shaharga
						moslashadi.
					</p>
					<div className='overflow-hidden rounded-2xl bg-white shadow-card'>
						{cities.map((city, index) => {
							const cityMeta = CITY_META[city] ?? CITY_META.Toshkent
							return (
								<button
									key={city}
									type='button'
									onClick={() => {
										setSelectedCity(city)
										setSelectedParkingId(null)
										// Another city means another map; keeping the old target would
										// leave the transport strip routing across the country.
										setDestinationId(null)
										setSheet(null)
										showToast(`Shahar: ${city}`)
									}}
									className={`flex w-full items-center gap-3 px-4 py-3 text-left ${index ? 'border-t border-line' : ''}`}
								>
									<span className='grid size-10 shrink-0 place-items-center rounded-xl bg-warn-bg text-warn'>
										<Sun className='size-5' />
									</span>
									<span className='min-w-0 flex-1'>
										<span className='block text-sm font-black text-ink'>
											{city}
										</span>
										<span className='mt-0.5 block text-[11px] text-ink-3'>
											{cityMeta.temp}° · {cityMeta.sky} · {cityMeta.population}
										</span>
									</span>
									{selectedCity === city ? (
										<Check className='size-5 text-brand' />
									) : (
										<ChevronRight className='size-4 text-ink-3' />
									)}
								</button>
							)
						})}
					</div>
				</BottomSheet>
			)}

			{sheet?.type === 'layers' && (
				<BottomSheet title='Xarita qatlamlari' onClose={() => setSheet(null)}>
					<p className='mb-3 text-xs text-ink-3'>
						Yoqilgan qatlamlar darhol bosh sahifadagi xaritada ko‘rinadi.
					</p>
					<div className='overflow-hidden rounded-2xl bg-white shadow-card'>
						{MAP_LAYERS.map((layer, index) => (
							<div
								key={layer.id}
								className={`flex items-center gap-3 px-4 py-3 ${index ? 'border-t border-line' : ''}`}
							>
								<span
									className={`grid size-10 shrink-0 place-items-center rounded-xl ${layer.tone}`}
								>
									<layer.icon className='size-5' />
								</span>
								<div className='min-w-0 flex-1'>
									<p className='text-sm font-black text-ink'>
										{layer.label}
									</p>
									<p className='mt-0.5 text-[11px] text-ink-3'>
										{layer.description}
									</p>
								</div>
								<Switch
									checked={layers[layer.id]}
									onChange={() => toggleLayer(layer.id)}
									label={layer.label}
								/>
							</div>
						))}
					</div>
				</BottomSheet>
			)}

			{sheet?.type === 'weather' && (
				<BottomSheet
					title={`${selectedCity} ob-havosi`}
					onClose={() => setSheet(null)}
				>
					<div className='rounded-3xl bg-white p-5 text-center shadow-card'>
						<Sun className='mx-auto size-12 text-warn' />
						<p className='mt-3 text-4xl font-black text-ink'>
							{meta.temp}°
						</p>
						<p className='mt-1 text-sm text-ink-3'>
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
								className='rounded-2xl bg-white p-3 text-center shadow-card'
							>
								<Sun className='mx-auto size-4 text-brand' />
								<p className='mt-2 text-sm font-black text-ink'>
									{value}
								</p>
								<p className='mt-1 text-[10px] leading-4 text-ink-3'>
									{label}
								</p>
							</div>
						))}
					</div>
					<div className='mt-3 rounded-2xl border border-brand-100 bg-brand-50 p-4'>
						<p className='text-xs font-black text-brand-600'>
							Bugungi tavsiya
						</p>
						<p className='mt-1 text-xs leading-5 text-ink-2'>
							Ertalab piyoda va skuter uchun qulay. Tush payti issiqroq bo‘ladi.
						</p>
					</div>
				</BottomSheet>
			)}

			{sheet?.type === 'history' && (
				<BottomSheet title='Tarix' onClose={() => setSheet(null)}>
					{reservations.length ? (
						<div className='overflow-hidden rounded-2xl bg-white shadow-card'>
							{reservations.slice(0, 6).map((reservation, index) => {
								const parking = PARKINGS.find(
									item => item.id === reservation.parkingId,
								)
								return (
									<Link
										key={reservation.id}
										href='/bookings'
										onClick={() => setSheet(null)}
										className={`flex items-center gap-3 px-4 py-3 ${index ? 'border-t border-line' : ''}`}
									>
										<span
											className={`grid size-10 shrink-0 place-items-center rounded-xl bg-linear-to-br ${parking?.accent ?? 'from-ink-3 to-ink'} text-white`}
										>
											<CircleParking className='size-5' />
										</span>
										<span className='min-w-0 flex-1'>
											<span className='block truncate text-sm font-black text-ink'>
												{parking?.name ?? 'Parking'}
											</span>
											<span className='mt-0.5 block text-[11px] text-ink-3'>
												{reservation.status} · {reservation.durationHours} soat
											</span>
										</span>
										<ChevronRight className='size-4 text-ink-3' />
									</Link>
								)
							})}
						</div>
					) : (
						<div className='rounded-2xl bg-white p-6 text-center text-sm text-ink-3 shadow-card'>
							Hali bron tarixi yo‘q.
						</div>
					)}
					<Link
						href='/bookings'
						onClick={() => setSheet(null)}
						className='mt-4 flex h-12 items-center justify-center rounded-2xl bg-brand text-sm font-black text-white'
					>
						Barcha bronlar
					</Link>
				</BottomSheet>
			)}

			{sheet?.type === 'sort' && (
				<BottomSheet title='Saralash va filtr' onClose={() => setSheet(null)}>
					<div className='overflow-hidden rounded-2xl bg-white shadow-card'>
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
								className={`flex w-full items-center gap-3 px-4 py-3 text-left ${index ? 'border-t border-line' : ''}`}
							>
								<span className='grid size-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand'>
									<Sparkles className='size-5' />
								</span>
								<span className='min-w-0 flex-1 text-sm font-black text-ink'>
									{label}
								</span>
								{sortMode === id && (
									<Check className='size-5 text-brand' />
								)}
							</button>
						))}
					</div>
					<button
						type='button'
						onClick={() => setFavoriteOnly(value => !value)}
						className='mt-3 flex w-full items-center justify-between rounded-2xl bg-white p-4 shadow-card'
					>
						<span className='text-sm font-black text-ink'>
							Faqat sevimlilar
						</span>
						<span
								className={`relative h-7 w-12 rounded-full transition duration-200 ${favoriteOnly ? 'bg-brand' : 'bg-line'}`}
						>
							<span
								className={`absolute top-1 size-5 rounded-full bg-white shadow transition duration-200 ${favoriteOnly ? 'left-6' : 'left-1'}`}
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
									<span className='text-[11px] font-bold text-ink-2'>
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
										className='flex items-center gap-3 rounded-2xl bg-white p-3 shadow-card'
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
											<p className='truncate text-sm font-black text-ink'>
												{parking.name}
											</p>
											<p className='mt-1 text-[11px] text-ink-3'>
												{distance.toFixed(1)} km ·{' '}
												{formatUZS(parking.pricePerHour)}/soat
											</p>
											<p
												className={`mt-1 text-[11px] font-black ${parking.availableSpaces > 0 ? 'text-ok' : 'text-bad'}`}
											>
												{parking.availableSpaces > 0
													? `${parking.availableSpaces} bo‘sh joy`
													: 'TO‘LA'}
											</p>
										</button>
										<Link
											href={`/parking/${parking.id}`}
											onClick={() => setSheet(null)}
											className='grid size-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand'
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
										className='flex w-full items-center gap-3 rounded-2xl bg-white p-3 text-left shadow-card'
									>
										<span
											className={`grid size-14 shrink-0 place-items-center rounded-2xl bg-linear-to-br ${place.accent} text-white`}
										>
											<MapPin className='size-6' />
										</span>
										<span className='min-w-0 flex-1'>
											<span className='block truncate text-sm font-black text-ink'>
												{place.title}
											</span>
											<span className='mt-1 block truncate text-[11px] text-ink-3'>
												{place.subtitle} · {place.distanceKm.toFixed(1)} km
											</span>
										</span>
										<ChevronRight className='size-4 text-ink-3' />
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
					// What this venue itself can be booked for. A queue only where
					// the catalog actually has a desk — no dead «Navbat olish» —
					// and a table only where eating is the point of the place.
					const queueOrg = getQueueOrgByPlace(place.id)
					const canBookTable = place.category === 'food'
					const hasVenueActions = Boolean(queueOrg) || canBookTable
					return (
						<BottomSheet title={place.title} onClose={() => setSheet(null)}>
							<div className='overflow-hidden rounded-3xl bg-white shadow-card'>
								<div className={`h-32 bg-linear-to-br ${place.accent}`} />
								<div className='p-4'>
									<div className='flex items-start justify-between gap-3'>
										<div className='min-w-0'>
											<p className='text-xl font-black text-ink'>
												{place.title}
											</p>
											<p className='mt-1 flex items-center gap-2 text-xs text-ink-3'>
												<Star className='size-4 fill-star text-star' />{' '}
												{place.rating} · {formatNumber(place.reviews)}{' '}
												sharh
											</p>
										</div>
										<button
											type='button'
											onClick={() => togglePlaceFavorite(place.id)}
											className={`inline-flex h-10 shrink-0 items-center gap-2 rounded-xl px-3 text-xs font-black transition active:scale-95 ${
												favorite
													? 'bg-bad-bg text-bad'
													: 'bg-card-2 text-ink-2'
											}`}
											aria-label={
												favorite
													? `${place.title}ni sevimlilardan olib tashlash`
													: `${place.title}ni sevimlilarga qo‘shish`
											}
										>
											<Heart
												className={`size-4 ${favorite ? 'fill-bad text-bad' : 'text-ink-3'}`}
											/>
											{favorite ? 'Sevimlilarda' : 'Sevimlilarga'}
										</button>
									</div>
									<p className='mt-3 flex items-center gap-2 text-xs text-ink-3'>
										<MapPin className='size-4 shrink-0' /> {place.address}
									</p>
									<p className='mt-2 flex items-center gap-2 text-xs text-ink-3'>
										<Clock3 className='size-4 shrink-0' /> {place.subtitle}
									</p>
								</div>
							</div>

							<div className='mt-3 grid grid-cols-3 gap-2'>
								<div className='rounded-2xl bg-white p-3 text-center shadow-card'>
									<Navigation className='mx-auto size-4 text-brand' />
									<p className='mt-2 text-lg font-black text-ink'>
										{Math.max(3, Math.round(place.distanceKm * 5))} daq
									</p>
									<p className='text-[10px] text-ink-3'>
										{place.distanceKm.toFixed(1)} km
									</p>
								</div>
								<div className='rounded-2xl bg-white p-3 text-center shadow-card'>
									<CircleParking className='mx-auto size-4 text-brand' />
									<p className='mt-2 text-lg font-black text-ok'>
										{place.free ?? '—'}
									</p>
									<p className='text-[10px] text-ink-3'>
										{place.total ? `${place.total} tadan` : 'parking'}
									</p>
								</div>
								<div className='rounded-2xl bg-white p-3 text-center shadow-card'>
									<History className='mx-auto size-4 text-brand' />
									<p className='mt-2 text-lg font-black text-ink'>
										{/* The queue desk's own number when there is one, so the
										    stat and the «Navbat olish» button never disagree. */}
										{queueOrg
											? `${queueOrg.waitMinutes} daq`
											: place.queue
												? `${place.queue} daq`
												: '—'}
									</p>
									<p className='text-[10px] text-ink-3'>navbat</p>
								</div>
							</div>

							<div className='mt-3 rounded-2xl bg-white p-4 shadow-card'>
								<div className='flex items-center justify-between'>
									<p className='text-sm font-black text-ink'>
										Hozirgi yuklama
									</p>
									<p className='text-sm font-black text-load-high'>
										{place.busy}%
									</p>
								</div>
								<div className='mt-2 h-2 overflow-hidden rounded-full bg-card-2'>
									<div
										className='h-full rounded-full bg-load-high'
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
												className='w-full rounded-t-md bg-brand'
												style={{ height: `${height}%` }}
											/>
											<span className='text-[8px] text-ink-3'>
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
										className='inline-flex h-9 shrink-0 items-center rounded-xl bg-white px-3 text-xs font-bold text-ink-2 shadow-card'
									>
										{tag}
									</span>
								))}
							</HorizontalRail>

							{/* What you can book AT this venue. Above the utilities and
							    above the parking button, because the customer opened a
							    restaurant, not a car park. */}
							{hasVenueActions && (
								<div className='mt-3 rounded-2xl bg-white p-4 shadow-card'>
									<p className='text-sm font-black text-ink'>
										{place.title}da
									</p>
									<p className='mt-1 text-[11px] leading-4 text-ink-3'>
										Navbat va stol bronlari «Bron» bo‘limida saqlanadi.
									</p>

									<div className='mt-3 space-y-2'>
										{queueOrg && (
											<button
												type='button'
												onClick={() => openPlaceQueue(place.id)}
												className='flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-brand text-sm font-black text-white shadow-lg shadow-[0_6px_16px_rgb(108_71_224/.28)]'
											>
												<Users className='size-4' />
												Navbat olish · ~{queueOrg.waitMinutes} daq
											</button>
										)}
										{canBookTable && (
											<button
												type='button'
												onClick={() => openTableBooking(place.id)}
												className={
													queueOrg
														? 'flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-brand-50 text-sm font-black text-brand-600 ring-1 ring-brand-100'
														: 'flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-brand text-sm font-black text-white shadow-lg shadow-[0_6px_16px_rgb(108_71_224/.28)]'
												}
											>
												<CalendarDays className='size-4' />
												Stol bron qilish
											</button>
										)}
									</div>
								</div>
							)}

							<div className='mt-3 grid grid-cols-4 gap-2'>
								<button
									type='button'
									// The venue, not the lot beside it. This used to route to
									// place.parkingId, so «Yo‘nalish» on Coffee Lab asked for
									// directions to Amir Temur Square Parking.
									onClick={() => routeTo({ from: 'place', placeId: place.id })}
									className='flex flex-col items-center gap-2 rounded-2xl bg-white p-3 text-[10px] font-bold text-ink-2 shadow-card'
								>
									<Navigation className='size-5 text-brand' /> Yo‘nalish
								</button>
								<a
									href={`tel:${place.phone.replace(/\s/g, '')}`}
									className='flex flex-col items-center gap-2 rounded-2xl bg-white p-3 text-[10px] font-bold text-ink-2 shadow-card'
								>
									<Phone className='size-5 text-brand' /> Qo‘ng‘iroq
								</a>
								<button
									type='button'
									onClick={() => sharePlace(place)}
									className='flex flex-col items-center gap-2 rounded-2xl bg-white p-3 text-[10px] font-bold text-ink-2 shadow-card'
								>
									<Share2 className='size-5 text-brand' /> Ulashish
								</button>
								<button
									type='button'
									onClick={() => {
										if (place.parkingId) {
											setSheet(null)
											selectParking(place.parkingId)
										} else showToast('Xaritada ko‘rsatildi')
									}}
									className='flex flex-col items-center gap-2 rounded-2xl bg-white p-3 text-[10px] font-bold text-ink-2 shadow-card'
								>
									<MapPin className='size-5 text-brand' /> Xaritada
								</button>
							</div>

							{/* Parking stays one tap away, but as its own service rather
							    than as the restaurant's primary action. The old fallback
							    here booked a table at a fixed demo venue whenever a place
							    had no parking, which is not this place's table. */}
							{place.parkingId && (
								<>
									<button
										type='button'
										onClick={() => openParkingBooking(place.parkingId!)}
										className={`h-12 w-full rounded-2xl text-sm font-black ${
											hasVenueActions
												? 'mt-3 border border-line-2 bg-white text-ink'
												: 'mt-4 bg-brand text-white'
										}`}
									>
										<CircleParking className='mr-2 inline size-4 align-text-bottom text-brand' />
										Yaqin parkingni bron qilish
									</button>
									{hasVenueActions && (
										<p className='mt-2 text-center text-[11px] text-ink-3'>
											Parking — alohida xizmat, stol yoki navbatga kirmaydi.
										</p>
									)}
								</>
							)}
						</BottomSheet>
					)
				})()}

			{serviceBooking && (
				<ServiceBookingSheet
					kind={serviceBooking.kind}
					refId={serviceBooking.refId}
					onClose={() => setServiceBooking(null)}
					onNotify={showToast}
				/>
			)}

			{/* Mounted only while open, so a restaurant picked and then
			    abandoned never survives into the next attempt. */}
			{tableFlowOpen && (
				<TableBookingFlow
					onClose={() => setTableFlowOpen(false)}
					onNotify={showToast}
				/>
			)}

			{/* The same sheet /queues uses, opened on the venue the user is
			    looking at rather than on QUEUE_ORGS[0]. */}
			{queueOrgId &&
				(() => {
					const org = getQueueOrg(queueOrgId)
					if (!org) return null
					return (
						<TakeTicketSheet
							org={org}
							onClose={() => setQueueOrgId(null)}
						/>
					)
				})()}

			<ParkingBookingSheet
				parkingId={bookingParkingId}
				onClose={() => setBookingParkingId(null)}
				onNotify={showToast}
			/>

			{/* The picker /transport already owns, not a second address book.
			    «Mening joylashuvim» is left out: Home always routes from there. */}
			<DestinationSheet
				open={sheet?.type === 'destination'}
				onClose={closeDestinationPicker}
				onSelect={chooseDestination}
				selectedId={destinationId}
				currentLocationLabel={originValue}
				excludeId='me'
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
									<span className='grid size-11 shrink-0 place-items-center rounded-xl bg-canvas'>
										<Icon
											className={`size-5 ${service.tone}`}
											strokeWidth={1.8}
										/>
									</span>
									<span className='min-w-0 flex-1'>
										<span className='block text-sm font-bold text-ink'>
											{service.label}
										</span>
										<span className='mt-0.5 block text-xs text-ink-3'>
											{service.subtitle}
										</span>
									</span>
									<ChevronRight className='size-4 shrink-0 text-ink-3' />
								</button>
							)
						})}
					</div>
				</BottomSheet>
			)}

			{sheet?.type === 'event' &&
				(() => {
					const event = EVENTS.find(item => item.id === sheet.eventId)
					if (!event) return null
					return (
						<BottomSheet title={event.title} onClose={() => setSheet(null)}>
							<div className='overflow-hidden rounded-3xl bg-white shadow-card'>
								<div className={`h-36 bg-linear-to-br ${event.accent} p-4`}>
									<span className='rounded-xl bg-white/90 px-3 py-1.5 text-[10px] font-black text-ink'>
										{event.category}
									</span>
								</div>
								<div className='p-4'>
									<p className='text-xl font-black text-ink'>
										{event.title}
									</p>
									<p className='mt-2 flex items-center gap-2 text-xs text-ink-3'>
										<Clock3 className='size-4' /> {event.when} · {event.time}
									</p>
									<p className='mt-2 flex items-center gap-2 text-xs text-ink-3'>
										<MapPin className='size-4' /> {event.place}
									</p>
									<p className='mt-3 text-xs leading-5 text-ink-2'>
										{event.description}
									</p>
								</div>
							</div>
							<div className='mt-3 rounded-2xl bg-white p-4 shadow-card'>
								<div className='flex items-center justify-between text-sm'>
									<span className='text-ink-3'>Narx</span>
									<strong>{event.price}</strong>
								</div>
								<div className='my-3 h-px bg-card-2' />
								<div className='flex items-center justify-between text-sm'>
									<span className='text-ink-3'>Yaqin parking</span>
									<strong className='text-ok'>mavjud</strong>
								</div>
							</div>
							<div className='mt-4 grid grid-cols-2 gap-2'>
								{/* Was a toast that scheduled nothing. Saving the event is
								    the thing this app can actually honour — it puts it in
								    the Voqealar tab, which had no other source. */}
								<button
									type='button'
									onClick={() => {
										toggleEventFavorite(event.id)
										showToast(
											favoriteEvents.includes(event.id)
												? 'Sevimlilardan olib tashlandi'
												: 'Voqea sevimlilarga saqlandi',
										)
									}}
									className='flex h-12 items-center justify-center gap-2 rounded-2xl border border-line-2 bg-white text-sm font-black text-ink'
								>
									<Heart
										className={`size-4 ${favoriteEvents.includes(event.id) ? 'fill-bad text-bad' : 'text-ink-3'}`}
									/>
									{favoriteEvents.includes(event.id) ? 'Saqlangan' : 'Saqlash'}
								</button>
								<button
									type='button'
									onClick={() => {
										setSheet(null)
										routeTo({ from: 'event', eventId: event.id })
									}}
									className='h-12 rounded-2xl bg-brand text-sm font-black text-white'
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
								className='w-full overflow-hidden rounded-2xl bg-white text-left shadow-card'
							>
								<div className={`h-24 bg-linear-to-br ${event.accent} p-3`}>
									<span className='rounded-lg bg-white/90 px-2 py-1 text-[10px] font-black text-ink'>
										{event.when} · {event.time}
									</span>
								</div>
								<div className='p-3'>
									<p className='text-sm font-black text-ink'>
										{event.title}
									</p>
									<p className='mt-1 text-xs text-ink-3'>
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
					<p className='mb-3 text-xs leading-5 text-ink-3'>
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
								className='flex w-full items-center gap-3 rounded-2xl bg-white p-4 text-left shadow-card'
							>
								<span className='grid size-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand'>
									<Sparkles className='size-5' />
								</span>
								<span className='min-w-0 flex-1'>
									<span className='block text-sm font-black text-ink'>
										{tip.title}
									</span>
									<span className='mt-1 block text-xs leading-5 text-ink-3'>
										{tip.text}
									</span>
								</span>
								<ChevronRight className='size-4 text-ink-3' />
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

// City Goo's hl(): show which part of the row the query actually hit.
function Mark({ text, query }: { text: string; query: string }) {
	const [before, match, after] = highlightParts(text, query)
	if (!match) return <>{text}</>
	return (
		<>
			{before}
			<mark className='rounded-[3px] bg-brand-100 text-brand-600'>{match}</mark>
			{after}
		</>
	)
}
