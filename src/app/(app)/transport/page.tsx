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
import { isTransportMode, TRANSPORT_MODES, type TransportMode } from '@/lib/transport'
import { useUserLocation } from '@/lib/use-user-location'
import { externalNavigationHref, nearestParking, resolveRouteEndpoint } from '@/lib/route-endpoints'

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

function TransportRoute() {
	const params = useSearchParams()
	return <TransportView key={params.toString()} />
}

function TransportView() {
	const router = useRouter()
	const { saveRoute } = useApp()
	const searchParams = useSearchParams()
	const modeParam = searchParams.get('mode')
	const parkingIdParam = searchParams.get('parkingId')
	const targetParam = searchParams.get('target')

	const [mode, setMode] = useState<TransportMode>(() =>
		isTransportMode(modeParam) ? modeParam : 'car',
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
	const [destinationSheetOpen, setDestinationSheetOpen] = useState(false)
	// Kept in page state, so the pick survives every other interaction on
	// this screen for as long as the user stays in the transport flow.
	const [selectedDestinationId, setSelectedDestinationId] = useState<
		string | null
	>(() => targetParam ?? (parkingIdParam ? `parking:${parkingIdParam}` : 'magic-city'))
	// null means "wherever the GPS says I am" — the screen's default, and what
	// the address book's own "Mening joylashuvim" entry resolves back to.
	const [selectedOriginId, setSelectedOriginId] = useState('me')
	const [originSheetOpen, setOriginSheetOpen] = useState(false)
	const [openProblem, setOpenProblem] = useState<RouteProblem | null>(null)
	const [openBus, setOpenBus] = useState<DemoBus | null>(null)
	const [navigating, setNavigating] = useState(false)

	const { location, status, locate } = useUserLocation()
	useEffect(() => {
		locate()
	}, [locate])

	const originPoint = useMemo(() =>
		resolveRouteEndpoint(selectedOriginId, location)!, [selectedOriginId, location])
	const destinationPoint = useMemo(() =>
		resolveRouteEndpoint(selectedDestinationId ?? 'magic-city', location) ??
		resolveRouteEndpoint('magic-city', location)!, [selectedDestinationId, location])
	const destination = useMemo(() => getParking(destinationPoint.parkingId ?? '') ??
		nearestParking(destinationPoint), [destinationPoint])

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
			announceRecalc()
		},
		[announceRecalc],
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
		locate()
		announceRecalc()
	}, [locate, announceRecalc])

	const pickOrigin = useCallback(
		(id: string) => {
			setSelectedOriginId(id)
			setOriginSheetOpen(false)
			announceRecalc()
		},
		[announceRecalc],
	)

	// City Goo's tSwap. 'me' is how the address book spells the GPS fix, so a
	// swap that sends the current location to the destination slot keeps it
	// nameable rather than silently becoming "nearest parking".
	const swapEnds = useCallback(() => {
		setSelectedOriginId(destinationPoint.id)
		setSelectedDestinationId(originPoint.id)
		announceRecalc()
	}, [originPoint.id, destinationPoint.id, announceRecalc])

	if (!destination) {
		return (
			<div className='rounded-3xl bg-bad-bg p-6 text-sm text-bad'>
				Parking topilmadi.
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

	const filterCount = Object.values(filters).filter(Boolean).length

	const cost = estimateFareUZS(distanceValue, minutes, mode)
	const costLabel = MODE_COST_LABEL[mode]

	const drivingTip = DEMO_DRIVING_TIPS[mode]
	const speedRange = estimateOptimalSpeedRange(distanceValue, minutes)
	const tipValue = mode === 'car' ? `${speedRange.low}–${speedRange.high}` : drivingTip.demoValue
	const tipUnit = mode === 'car' ? 'km/soat' : drivingTip.demoUnit

	const gpsLabel =
		status === 'ready'
			? 'Joriy joylashuvingiz (GPS)'
			: status === 'loading'
				? 'Joylashuv aniqlanmoqda…'
				: 'Toshkent markazi (demo joylashuv)'

	const originStatusLabel = originPoint.id === 'me' ? gpsLabel
		: [originPoint.title, originPoint.address].filter(Boolean).join(', ')

	// City Goo shows the picked place itself in the "Qayerga" row; until
	// something is picked the row keeps showing the parking this route
	// already targets.
	const destinationValue = destinationPoint.id === 'me' ? gpsLabel
		: [destinationPoint.title, destinationPoint.address].filter(Boolean).join(', ')

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
			note: `${destination.availableSpaces} joy bo‘sh — ${destination.address}dan kirish.`,
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

	const cityMeta = CITY_META[destination.city] ?? CITY_META.Toshkent
	const WeatherIcon = weatherIconFor(cityMeta.sky)

	const navigateHref = externalNavigationHref(originPoint, destinationPoint, mode)

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
		{
			icon: CircleParking,
			tone: 'brand',
			title: 'Manzildagi parkovka',
			message: `${destination.totalSpaces} dan ${destination.availableSpaces} joy bo‘sh. Qidirmaslik uchun bron qiling.`,
			href:
				destination.availableSpaces > 0
					? undefined
					: `/parking/${destination.id}`,
			onSelect:
				destination.availableSpaces > 0
					? () => setBookingParkingId(destination.id)
					: undefined,
		},
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

			<LocationCard
				originLabel='Qayerdan'
				originValue={originStatusLabel}
				onOriginClick={() => setOriginSheetOpen(true)}
				onRefreshOrigin={refreshOrigin}
				refreshing={status === 'loading'}
				destinationLabel='Qayerga'
				destinationValue={destinationValue}
				onDestinationClick={() => setDestinationSheetOpen(true)}
				onSwap={swapEnds}
			/>

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
					locate()
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
				destination={destination}
			/>

			<button
				type='button'
				onClick={() => {
					saveRoute({
						title: destinationPoint.title,
						from: originStatusLabel,
						to: destinationValue,
						mode,
						parkingId: destination.id,
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
				weatherDetail={`${destination.city} uchun B SPACE’ning statik ob-havo ma’lumoti.`}
				onRefresh={() => locate()}
				refreshing={status === 'loading'}
			/>

			<DestinationParkingCard
				parking={destination}
				onReserve={() => setBookingParkingId(destination.id)}
			/>

			<RouteNotices notices={notices} />

			<RouteFiltersSheet
				open={filtersOpen}
				onClose={() => setFiltersOpen(false)}
				filters={filters}
				onToggle={toggleFilter}
			/>

			<DestinationSheet
				open={destinationSheetOpen}
				onClose={closeDestinationSheet}
				onSelect={pickDestination}
				selectedId={selectedDestinationId}
				currentLocationLabel={gpsLabel}
			/>

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
