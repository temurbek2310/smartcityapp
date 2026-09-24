'use client'

import {
	BellRing,
	Bookmark,
	Clock3,
	CircleParking,
	Cloud,
	CloudRain,
	Construction,
	LocateFixed,
	MapPin,
	MapPinOff,
	Navigation,
	Sun,
} from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useCallback, useMemo, useEffect, useState } from 'react'

import { AiRecommendationCard } from '@/components/transport/ai-recommendation-card'
import { AlternativeRoutes } from '@/components/transport/alternative-routes'
import { CurrentSituation } from '@/components/transport/current-situation'
import { ParkingBookingSheet } from '@/components/parking/parking-booking-sheet'
import { DestinationParkingCard } from '@/components/transport/destination-parking-card'
import { DestinationSheet } from '@/components/transport/destination-sheet'
import { DrivingRecommendationCard } from '@/components/transport/driving-recommendation-card'
import { LocationCard } from '@/components/transport/location-card'
import { PublicTransportSection, type PublicTransportTab } from '@/components/transport/public-transport-section'
import { RouteFiltersSheet, ROUTE_FILTERS, type RouteFilterId } from '@/components/transport/route-filters-sheet'
import { RouteMap, type RouteProblem } from '@/components/transport/route-map'
import { RouteNotices, type RouteNotice } from '@/components/transport/route-notices'
import { RouteSummary } from '@/components/transport/route-summary'
import { RouteTimeline, type TimelineStep } from '@/components/transport/route-timeline'
import { TransportHeader } from '@/components/transport/transport-header'
import { TurnByTurn } from '@/components/transport/turn-by-turn'
import { TransportModeSelector } from '@/components/transport/transport-mode-selector'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { KeyValue, KeyValueList } from '@/components/ui/key-value'
import { Toast } from '@/components/ui/toast'
import { useApp } from '@/context/app-context'
import { destinationParkingFor } from '@/lib/destination-parking'
import { reservationHref } from '@/lib/reservation'
import { CITY_META } from '@/data/city-meta'
import {
	DEMO_ALTERNATIVE_ROUTES,
	DEMO_BUSES,
	type DemoBus,
	DEMO_CURRENT_SITUATION,
	DEMO_DRIVING_TIPS,
	DEMO_METRO_LINES,
	DEMO_MICRO_OPTIONS,
	DEMO_ROADWORKS_NOTICE,
	DEMO_ROUTE_FACTS,
	DEMO_ROUTE_TIMELINE,
} from '@/data/demo-transport'
import { getParking } from '@/data/parkings'
import {
	estimateFareUZS,
	estimateMinutesForMode,
	estimateOptimalSpeedRange,
	fastestMode,
} from '@/lib/eta'
import { distanceKm } from '@/lib/geo'
import {
	DEFAULT_TRANSPORT_MODE,
	TRANSPORT_MODES,
	type TransportMode,
} from '@/lib/transport'
import { readRouteParams, routeHref } from '@/lib/navigation'
import {
	openTransportSession,
	recordTransportSync,
	transportSessionFor,
} from '@/lib/transport-session'
import { useLocation } from '@/context/location-context'
import { APPROXIMATE_ORIGIN_LABEL, currentLocationLabel } from '@/lib/location'
import {
	externalNavigationDestination,
	externalNavigationHref,
	externalNavigationOrigin,
	nearestParking,
	resolveRouteEndpoint,
	routeEndpointLabel,
} from '@/lib/route-endpoints'

const MODE_COST_LABEL: Record<TransportMode, string> = {
	car: 'yoqilg‘i',
	metro: 'chipta',
	scooter: 'ijara',
	walk: '',
}

function weatherIconFor(sky: string) {
	if (sky.toLowerCase().includes('yomg')) return CloudRain
	if (sky.toLowerCase().includes('bulut')) return Cloud
	return Sun
}

export default function TransportPage() {
	return (
		<Suspense
			fallback={
				<div className='py-24 text-center text-sm text-ink-3'>
					Yuklanmoqda…
				</div>
			}
		>
			<TransportRoute />
		</Suspense>
	)
}

// Remounts the view only when somebody else changes the query — a link, a
// saved route, back/forward — never for the URL sync the view does itself
// (see lib/transport-session.ts).
function TransportRoute() {
	const query = useSearchParams().toString()
	const [session, setSession] = useState(() => openTransportSession(query))
	const current = transportSessionFor(session, query)
	// Adjusting state while rendering, React's pattern for state derived from
	// a changed input: the new key applies in this same render pass.
	if (current !== session) setSession(current)
	const recordSync = useCallback(
		(next: string) => setSession(value => recordTransportSync(value, next)),
		[],
	)
	return <TransportView key={current.key} onUrlSync={recordSync} />
}

function TransportView({ onUrlSync }: { onUrlSync: (query: string) => void }) {
	const router = useRouter()
	const { saveRoute, reservations } = useApp()
	const searchParams = useSearchParams()
	// One reader for the whole app's route links, so a deep link built on
	// Home, in Bron or on the map is understood the same way here.
	const requested = useMemo(() => readRouteParams(searchParams), [searchParams])

	const [mode, setMode] = useState<TransportMode>(
		() => requested.mode ?? DEFAULT_TRANSPORT_MODE,
	)
	const [showRoute, setShowRoute] = useState(true)
	const [locateRevision, setLocateRevision] = useState(0)
	const [filtersOpen, setFiltersOpen] = useState(false)
	const [filters, setFilters] = useState<Record<RouteFilterId, boolean>>(
		() =>
			Object.fromEntries(
				ROUTE_FILTERS.map(filter => [filter.id, false]),
			) as Record<RouteFilterId, boolean>,
	)
	const [selectedAltIndex, setSelectedAltIndex] = useState(0)
	const [publicTab, setPublicTab] = useState<PublicTransportTab>('bus')
	// With nowhere to go, the picker is the screen: asking is the only honest
	// alternative to inventing a destination.
	const [destinationSheetOpen, setDestinationSheetOpen] = useState(
		() => !requested.destinationId,
	)
	// Kept in page state, so the pick survives every other interaction on
	// this screen for as long as the user stays in the transport flow. null
	// is a real state: arriving here without a destination used to silently
	// plot a route to Magic City, which is not where anybody asked to go.
	const [selectedDestinationId, setSelectedDestinationId] = useState<
		string | null
	>(() => requested.destinationId)
	// 'me' is "wherever the GPS says I am" — the screen's default, and what
	// the address book's own "Mening joylashuvim" entry resolves back to.
	const [selectedOriginId, setSelectedOriginId] = useState(
		() => requested.originId ?? 'me',
	)
	const [originSheetOpen, setOriginSheetOpen] = useState(false)
	const [openProblem, setOpenProblem] = useState<RouteProblem | null>(null)
	const [openBus, setOpenBus] = useState<DemoBus | null>(null)
	const [navigating, setNavigating] = useState(false)

	// The session's shared location. Opening this screen requests nothing: a
	// fix is either already here or waits for the customer to ask for one.
	const location = useLocation()
	const { position, status, requestLocation } = location
	const gpsReady = position !== null

	// An origin that cannot be resolved — a stale ?from= naming a place that
	// has since left the catalog — falls back to the live position, which is
	// this screen's default anyway and is never presented as anything else.
	const originPoint = useMemo(() =>
		resolveRouteEndpoint(selectedOriginId, position) ??
		resolveRouteEndpoint('me', position)!, [selectedOriginId, position])
	// No substitute here. A destination that will not resolve leaves the
	// screen in its "choose somewhere" state rather than routing elsewhere.
	const destinationPoint = useMemo(() => selectedDestinationId
		? resolveRouteEndpoint(selectedDestinationId, position) : null,
		[selectedDestinationId, position])
	// «Mening joylashuvim» as the destination with no fix: there is nowhere
	// real to route to, so the screen asks for location instead of routing to
	// the city centre.
	const destinationNeedsFix = destinationPoint?.kind === 'me' && destinationPoint.approximate
	// The lot this route ends at or beside — used for the destination's city,
	// which is not a claim about parking. What the screen actually offers the customer is `suggestion`.
	const arrivalParking = useMemo(() => destinationPoint
		? getParking(destinationPoint.parkingId ?? '') ?? nearestParking(destinationPoint)
		: undefined, [destinationPoint])
	// Somewhere to leave the car, and only when there is a car and it is not
	// the destination itself. Null for metro, scooter and walking.
	const suggestion = useMemo(() => destinationPoint
		? destinationParkingFor({ destination: destinationPoint, mode, reservations })
		: null, [destinationPoint, mode, reservations])

	// Toast. A recalculation only records that it happened — its duration is
	// read from the live route further down, so the text can never drift
	// from what the page is showing and self-corrects when a location fix
	// lands while the toast is up. The booking sheet reports through the
	// same toast rather than bringing a second one.
	const [toastKind, setToastKind] = useState<
		{ kind: 'recalc' } | { kind: 'message'; text: string }
	>({ kind: 'recalc' })
	const [toastOpen, setToastOpen] = useState(false)
	const [toastRevision, setToastRevision] = useState(0)

	useEffect(() => {
		if (!toastOpen) return

		const timerId = window.setTimeout(() => {
			setToastOpen(false)
		}, 2200)

		return () => {
			window.clearTimeout(timerId)
		}
	}, [toastOpen, toastRevision])

	// Kept after closing so the message stays put while the toast slides out.
	const showToast = useCallback(
		(next: { kind: 'recalc' } | { kind: 'message'; text: string }) => {
			setToastKind(next)
			setToastOpen(true)
			setToastRevision(current => current + 1)
		},
		[],
	)

	const announceRecalc = useCallback(
		() => showToast({ kind: 'recalc' }),
		[showToast],
	)

	const notifyBooking = useCallback(
		(text: string) => showToast({ kind: 'message', text }),
		[showToast],
	)

	const [bookingParkingId, setBookingParkingId] = useState<string | null>(null)
	const closeBookingSheet = useCallback(() => setBookingParkingId(null), [])

	const closeDestinationSheet = useCallback(
		() => setDestinationSheetOpen(false),
		[],
	)

	const pickDestination = useCallback(
		(id: string) => {
			setSelectedDestinationId(id)
			setDestinationSheetOpen(false)
			// Choosing «Mening joylashuvim» is asking for location.
			if (id === 'me' && !gpsReady) requestLocation()
			announceRecalc()
		},
		[announceRecalc, gpsReady, requestLocation],
	)

	const changeMode = useCallback(
		(next: TransportMode) => {
			setMode(next)
			announceRecalc()
		},
		[announceRecalc],
	)

	const refreshOrigin = useCallback(() => {
		setLocateRevision(current => current + 1)
		requestLocation()
		announceRecalc()
	}, [requestLocation, announceRecalc])

	const pickOrigin = useCallback(
		(id: string) => {
			setSelectedOriginId(id)
			setOriginSheetOpen(false)
			if (id === 'me' && !gpsReady) requestLocation()
			announceRecalc()
		},
		[announceRecalc, gpsReady, requestLocation],
	)

	// City Goo's tSwap. 'me' is how the address book spells the GPS fix, so a
	// swap that sends the current location to the destination slot keeps it
	// nameable rather than silently becoming "nearest parking".
	const swapEnds = useCallback(() => {
		if (!destinationPoint) return
		setSelectedOriginId(destinationPoint.id)
		setSelectedDestinationId(originPoint.id)
		announceRecalc()
	}, [originPoint.id, destinationPoint, announceRecalc])

	// Shared with Home's destination picker so both screens name the
	// customer's own position, and each of its fallbacks, with the same words.
	const gpsLabel = currentLocationLabel(location)

	// Without a fix the demo route still starts somewhere — the city centre —
	// and says so, rather than calling it the customer's position.
	const originStatusLabel = originPoint.id !== 'me'
		? [originPoint.title, originPoint.address].filter(Boolean).join(', ')
		: originPoint.approximate && status !== 'loading'
			? APPROXIMATE_ORIGIN_LABEL
			: gpsLabel

	// The picked place itself, exactly as the picker named it.
	const destinationValue = !destinationPoint ? '' :
		destinationPoint.id === 'me' ? gpsLabel
		: [destinationPoint.title, destinationPoint.address].filter(Boolean).join(', ')

	// Keep the address bar on the trip actually being shown, so refreshing or
	// sharing the link reproduces it. replaceState rather than router.replace,
	// and announced to TransportRoute first, so the query it writes reads back
	// as this view's own and the view stays mounted with its filters, tabs
	// and map intact.
	useEffect(() => {
		if (!selectedDestinationId) return
		const href = routeHref({
			mode,
			destinationId: selectedDestinationId,
			originId: selectedOriginId,
		})
		if (window.location.pathname + window.location.search === href) return
		onUrlSync(new URL(href, window.location.origin).searchParams.toString())
		window.history.replaceState(null, '', href)
	}, [mode, selectedDestinationId, selectedOriginId, onUrlSync])

	const filterCount = Object.values(filters).filter(Boolean).length

	const destinationSheet = (
		<DestinationSheet
			open={destinationSheetOpen}
			onClose={closeDestinationSheet}
			onSelect={pickDestination}
			selectedId={selectedDestinationId}
			currentLocationLabel={gpsLabel}
		/>
	)

	const locationCard = (
		<LocationCard
			originLabel='Qayerdan'
			originValue={originStatusLabel}
			onOriginClick={() => setOriginSheetOpen(true)}
			onRefreshOrigin={refreshOrigin}
			refreshing={status === 'loading'}
			destinationLabel='Qayerga'
			destinationValue={destinationValue || 'Manzil tanlang'}
			onDestinationClick={() => setDestinationSheetOpen(true)}
			onSwap={swapEnds}
		/>
	)

	// Nowhere to go yet — either nothing was passed in, or the id that was
	// names something the catalogs no longer contain. Both are states the
	// screen shows and asks about; neither is a reason to route elsewhere.
	if (!destinationPoint || !arrivalParking || destinationNeedsFix) {
		return (
			<div className='-mx-1 space-y-5 pb-4'>
				<TransportHeader
					title='Transport'
					subtitle='Qayerga borishni tanlang'
					filterCount={filterCount}
					onBack={() => router.back()}
					onFilterClick={() => setFiltersOpen(true)}
				/>

				{locationCard}

				<TransportModeSelector selected={mode} onSelect={setMode} />

				{destinationNeedsFix ? (
					<Card className='text-center'>
						<span className='mx-auto grid size-12 place-items-center rounded-2xl bg-warn-bg text-warn'>
							<MapPinOff className='size-6' />
						</span>
						<p className='mt-3 text-[15px] font-extrabold text-ink'>
							{status === 'loading' ? 'Joylashuv aniqlanmoqda…' : 'Joylashuvingiz aniqlanmagan'}
						</p>
						<p className='mt-1.5 text-[12.5px] leading-5 text-ink-3'>
							Marshrutni joylashuvingizgacha qurish uchun joylashuvga ruxsat
							bering yoki boshqa manzilni tanlang.
						</p>
						<Button
							variant='primary'
							block
							className='mt-4'
							disabled={status === 'loading'}
							onClick={refreshOrigin}
						>
							<LocateFixed className='size-4' /> Joylashuvni aniqlash
						</Button>
						<Button
							block
							className='mt-2'
							onClick={() => setDestinationSheetOpen(true)}
						>
							<MapPin className='size-4' /> Boshqa manzil
						</Button>
					</Card>
				) : (
				<Card className='text-center'>
					<span className='mx-auto grid size-12 place-items-center rounded-2xl bg-brand-50 text-brand'>
						<MapPin className='size-6' />
					</span>
					<p className='mt-3 text-[15px] font-extrabold text-ink'>
						Manzil tanlanmagan
					</p>
					<p className='mt-1.5 text-[12.5px] leading-5 text-ink-3'>
						{selectedDestinationId
							? 'Bu manzil endi mavjud emas. Boshqa joyni tanlang.'
							: 'Parking, restoran yoki boshqa joyni tanlang — marshrut shundan keyin quriladi.'}
					</p>
					<Button
						variant='primary'
						block
						className='mt-4'
						onClick={() => setDestinationSheetOpen(true)}
					>
						<MapPin className='size-4' /> Manzilni tanlash
					</Button>
				</Card>
				)}

				<RouteFiltersSheet
					open={filtersOpen}
					onClose={() => setFiltersOpen(false)}
					filters={filters}
					onToggle={toggleFilter}
				/>

				{destinationSheet}

				<DestinationSheet
					title='Qayerdan'
					open={originSheetOpen}
					onClose={() => setOriginSheetOpen(false)}
					onSelect={pickOrigin}
					selectedId={selectedOriginId}
					currentLocationLabel={gpsLabel}
				/>
			</div>
		)
	}

	const distanceValue = distanceKm(originPoint, destinationPoint)
	const minutes = estimateMinutesForMode(distanceValue, mode)
	const modesOnly = TRANSPORT_MODES.map(item => item.id)
	const fastest = fastestMode(distanceValue, modesOnly)
	const minutesByMode = Object.fromEntries(
		modesOnly.map(id => [id, estimateMinutesForMode(distanceValue, id)]),
	) as Record<TransportMode, number>

	const cost = estimateFareUZS(distanceValue, minutes, mode)
	const costLabel = MODE_COST_LABEL[mode]

	const drivingTip = DEMO_DRIVING_TIPS[mode]
	const speedRange = estimateOptimalSpeedRange(distanceValue, minutes)
	const tipValue = mode === 'car' ? `${speedRange.low}–${speedRange.high}` : drivingTip.demoValue
	const tipUnit = mode === 'car' ? 'km/soat' : drivingTip.demoUnit

	const timelineSteps: TimelineStep[] = [
		{
			icon: LocateFixed,
			tone: '#6c47e0',
			title: 'Boshlanish',
			subtitle: originStatusLabel,
			distanceLabel: '0 km',
			distanceKm: 0,
		},
		...DEMO_ROUTE_TIMELINE[mode].map(step => ({
			icon: step.icon,
			tone: step.tone,
			title: step.title,
			subtitle: step.subtitle,
			distanceLabel: `${(step.atFraction * distanceValue).toFixed(1)} km`,
			distanceKm: step.atFraction * distanceValue,
			note: step.note,
		})),
		{
			icon: CircleParking,
			tone: '#6c47e0',
			title: destinationPoint.title,
			subtitle: destinationPoint.address,
			distanceLabel: `${distanceValue.toFixed(1)} km`,
			distanceKm: distanceValue,
			// Only about parking when parking is being offered, and never
			// phrased as if the car park were the place you are going.
			note: !suggestion
				? undefined
				: suggestion.kind === 'destination'
					? `${suggestion.parking.availableSpaces} joy bo‘sh — ${suggestion.parking.address}dan kirish.`
					: `${suggestion.label}: ${suggestion.parking.name} · ${suggestion.parking.availableSpaces} joy bo‘sh.`,
		},
	]

	const altTemplates = DEMO_ALTERNATIVE_ROUTES[mode]
	const alternatives = altTemplates.map(template => ({
		title: template.title,
		distanceKm: distanceValue * template.distanceFactor,
		minutes: Math.max(3, Math.round(minutes * template.timeFactor)),
		trafficLabel: template.trafficLabel,
		trafficTone: template.trafficTone,
		note: template.note,
		best: template.best,
	}))

	const cityMeta = CITY_META[arrivalParking.city] ?? CITY_META.Toshkent
	const WeatherIcon = weatherIconFor(cityMeta.sky)

	// null for scooter, which 2GIS has no route type for.
	const navigateHref = externalNavigationHref({
		origin: externalNavigationOrigin(originPoint, gpsReady),
		destination: externalNavigationDestination(destinationPoint, gpsReady),
		mode,
	})

	const notices: RouteNotice[] = [
		{
			icon: Clock3,
			tone: 'ok',
			title: 'Hozir yo‘lga chiqing',
			message: `${TRANSPORT_MODES.find(item => item.id === mode)?.label ?? ''} bilan ≈${minutes} daqiqada yetib borasiz.`,
		},
		{
			icon: Construction,
			tone: 'warn',
			title: DEMO_ROADWORKS_NOTICE.title,
			message: DEMO_ROADWORKS_NOTICE.message,
		},
		// Dropped entirely when there is no parking to offer, rather than
		// kept as an empty claim about the destination.
		...(suggestion
			? [
					{
						icon: CircleParking,
						tone: 'brand' as const,
						title: suggestion.label,
						message: suggestion.reservation
							? `${suggestion.parking.name} — bu parkingda broningiz bor.`
							: `${suggestion.parking.name} · ${suggestion.parking.totalSpaces} dan ${suggestion.parking.availableSpaces} joy bo‘sh.`,
						href: suggestion.reservation
							? reservationHref(suggestion.reservation)
							: suggestion.parking.availableSpaces > 0
								? undefined
								: `/parking/${suggestion.parking.id}`,
						onSelect:
							!suggestion.reservation && suggestion.parking.availableSpaces > 0
								? () => setBookingParkingId(suggestion.parking.id)
								: undefined,
					},
				]
			: []),
	]

	function toggleFilter(id: RouteFilterId) {
		setFilters(current => ({ ...current, [id]: !current[id] }))
	}

	return (
		<div className='-mx-1 space-y-5 pb-4'>
			<TransportHeader
				title='Transport'
				subtitle='AI eng yaxshi yo‘lni tanlaydi'
				filterCount={filterCount}
				onBack={() => router.back()}
				onFilterClick={() => setFiltersOpen(true)}
			/>

			{locationCard}

			<TransportModeSelector
				selected={mode}
				minutesByMode={minutesByMode}
				onSelect={changeMode}
			/>

			<RouteMap
				origin={originPoint}
				locating={status === 'loading'}
				locateRevision={locateRevision}
				onLocate={() => {
					setLocateRevision(current => current + 1)
					requestLocation()
				}}
				destination={destinationPoint}
				showRoute={showRoute}
				onToggleRoute={() => setShowRoute(current => !current)}
				onOpenProblem={setOpenProblem}
			/>

			<AiRecommendationCard
				key={`${mode}:${minutes}`}
				currentMode={mode}
				currentMinutes={minutes}
				fastestMode={fastest.mode}
				fastestMinutes={fastest.minutes}
				onSwitch={changeMode}
			/>

			<RouteSummary
				mode={mode}
				minutes={minutes}
				distanceKm={distanceValue}
				costUZS={cost}
				costLabel={costLabel}
				facts={DEMO_ROUTE_FACTS[mode]}
				parkingSuggestion={suggestion ?? undefined}
			/>

			<button
				type='button'
				onClick={() => {
					// Stable identity, not what the location looked like just
					// now: Favorites re-derives the labels from these ids.
					saveRoute({
						title: destinationPoint.title,
						from: routeEndpointLabel(originPoint.id) ?? originStatusLabel,
						to: routeEndpointLabel(destinationPoint.id) ?? destinationValue,
						mode,
						// The place itself, not the lot beside it: replaying the route
						// from Favorites has to end where this one does.
						destinationId: destinationPoint.id,
						originId: selectedOriginId,
					})
					notifyBooking('Marshrut sevimlilarga saqlandi')
				}}
				className='flex h-11 w-full items-center justify-center gap-2 rounded-card bg-card text-[13px] font-bold text-ink shadow-card'
			>
				<Bookmark className='size-4 text-brand' /> Marshrutni saqlash
			</button>

			<RouteTimeline
				steps={timelineSteps}
				onStartNavigation={() => setNavigating(true)}
			/>

			<DrivingRecommendationCard
				title={drivingTip.title}
				explain={drivingTip.explain}
				value={tipValue}
				unit={tipUnit}
			/>

			<AlternativeRoutes
				routes={alternatives}
				selectedIndex={selectedAltIndex}
				onSelect={setSelectedAltIndex}
			/>

			<PublicTransportSection
				activeTab={publicTab}
				onChangeTab={setPublicTab}
				buses={DEMO_BUSES}
				onOpenBus={setOpenBus}
				metroLines={DEMO_METRO_LINES}
				microOptions={DEMO_MICRO_OPTIONS}
			/>

			<CurrentSituation
				rows={DEMO_CURRENT_SITUATION}
				weatherIcon={WeatherIcon}
				weatherLabel={`+${cityMeta.temp}° ${cityMeta.sky}`}
				weatherDetail={`${arrivalParking.city} uchun B SPACE’ning statik ob-havo ma’lumoti.`}
				// Renews an allowed fix; never raises a permission prompt.
				onRefresh={() => {
					if (location.permission === 'granted') requestLocation()
				}}
				refreshing={status === 'loading'}
			/>

			{suggestion && (
				<DestinationParkingCard
					suggestion={suggestion}
					destinationTitle={destinationPoint.title}
					onReserve={() => setBookingParkingId(suggestion.parking.id)}
				/>
			)}

			<RouteNotices notices={notices} />

			<RouteFiltersSheet
				open={filtersOpen}
				onClose={() => setFiltersOpen(false)}
				filters={filters}
				onToggle={toggleFilter}
			/>

			{destinationSheet}

			<DestinationSheet
				title='Qayerdan'
				open={originSheetOpen}
				onClose={() => setOriginSheetOpen(false)}
				onSelect={pickOrigin}
				selectedId={selectedOriginId ?? 'me'}
				currentLocationLabel={gpsLabel}
			/>

			<ParkingBookingSheet
				parkingId={bookingParkingId}
				onClose={closeBookingSheet}
				onNotify={notifyBooking}
			/>

			{navigating && (
				<TurnByTurn
					steps={timelineSteps.slice(1)}
					minutes={minutes}
					navigateHref={navigateHref}
					onClose={() => {
						setNavigating(false)
						notifyBooking('Navigatsiya yopildi')
					}}
					onComplete={() => {
						setNavigating(false)
						notifyBooking(`Yetib keldingiz · ${destinationPoint.title}`)
					}}
				/>
			)}

			{openProblem && (
				<BottomSheet
					title={openProblem.title}
					onClose={() => setOpenProblem(null)}
				>
					<Card>
						<p className='text-[13px] leading-5 text-ink-2'>
							{openProblem.detail}
						</p>
					</Card>
					<Button
						variant='primary'
						block
						className='mt-4'
						onClick={() => {
							setOpenProblem(null)
							announceRecalc()
						}}
					>
						Marshrutni qayta hisoblash
					</Button>
				</BottomSheet>
			)}

			{openBus && (
				<BottomSheet
					title={`Avtobus ${openBus.number}`}
					onClose={() => setOpenBus(null)}
				>
					<Card>
						<KeyValueList>
							<KeyValue label='Yo‘nalish' value={openBus.route} />
							<KeyValue
								label='Kelish vaqti'
								value={`${openBus.arrivalMin} daqiqa`}
							/>
							<KeyValue label='Bekatlar' value={`${openBus.stops} ta`} />
							<KeyValue
								label='Bandlik'
								value={`${openBus.occupancyPct}% · ${openBus.passengers} yo‘lovchi`}
							/>
							<KeyValue
								label='Joylar'
								value={`${openBus.seated} o‘rindiqli / ${openBus.standing} tik`}
							/>
						</KeyValueList>
					</Card>
					<Button
						variant='primary'
						block
						className='mt-4'
						onClick={() => {
							const number = openBus.number
							const minutes = openBus.arrivalMin
							setOpenBus(null)
							notifyBooking(
								`${number}-avtobus ${minutes} daqiqada kelganda xabar beramiz`,
							)
						}}
					>
						<BellRing className='size-4' /> Kelganda xabar berish
					</Button>
				</BottomSheet>
			)}

			{/* Duration is read from the live route, never stored with the toast. */}
			<Toast
				open={toastOpen}
				message={
					toastKind.kind === 'message'
						? toastKind.text
						: `Yo‘nalish qayta hisoblandi · ${minutes} daqiqa`
				}
				icon={toastKind.kind === 'message' ? CircleParking : Navigation}
			/>
		</div>
	)
}
