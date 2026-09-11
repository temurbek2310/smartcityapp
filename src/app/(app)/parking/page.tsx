'use client'

import { ArrowUpDown, CircleParking, LocateFixed, SlidersHorizontal, Tag } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'

import { ParkingMap } from '@/components/map/parking-map'
import { ActiveBookingBanner } from '@/components/parking/active-booking-banner'
import { OccupancyForecastCard } from '@/components/parking/occupancy-forecast-card'
import { ParkingBookingSheet } from '@/components/parking/parking-booking-sheet'
import { ParkingCard } from '@/components/parking/parking-card'
import { ParkingFiltersSheet } from '@/components/parking/parking-filters-sheet'
import { AppBar } from '@/components/ui/app-bar'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Chip } from '@/components/ui/chip'
import { EmptyState } from '@/components/ui/empty-state'
import { HorizontalRail } from '@/components/ui/horizontal-rail'
import { IconButton } from '@/components/ui/icon-button'
import { SearchField } from '@/components/ui/search-field'
import { SectionHeader } from '@/components/ui/section-header'
import { Toast } from '@/components/ui/toast'
import { useApp } from '@/context/app-context'
import { PARKINGS } from '@/data/parkings'
import { useToast } from '@/hooks/use-toast'
import {
	LOAD_BANDS,
	PARKING_CHIPS,
	PARKING_SORTS,
	useParkingFilters,
} from '@/hooks/use-parking-filters'
import { cn } from '@/lib/cn'
import { useUserLocation } from '@/lib/use-user-location'

export default function ParkingListPage() {
	const router = useRouter()
	const toast = useToast<string>()
	const { reservations } = useApp()
	const { location, status, locate } = useUserLocation()

	const [sortOpen, setSortOpen] = useState(false)
	const [filtersOpen, setFiltersOpen] = useState(false)
	const [bookingParkingId, setBookingParkingId] = useState<string | null>(null)
	const [forecastId, setForecastId] = useState(PARKINGS[1]?.id ?? PARKINGS[0].id)
	const [selectedId, setSelectedId] = useState<string | null>(null)

	useEffect(() => {
		locate()
	}, [locate])

	const filters = useParkingFilters(PARKINGS, location)
	const { results } = filters

	// The one booking worth pinning: whichever is live, or next to start.
	const activeReservation = useMemo(
		() =>
			reservations
				.filter(item => item.status === 'active' || item.status === 'reserved')
				.sort((a, b) => (a.status === 'active' ? -1 : b.status === 'active' ? 1 : 0))[0],
		[reservations],
	)

	const forecastParking =
		PARKINGS.find(parking => parking.id === forecastId) ?? PARKINGS[0]
	const sortLabel =
		PARKING_SORTS.find(option => option.id === filters.sort)?.label ?? ''

	return (
		<div className='-mx-5 -mt-6 min-h-[calc(100dvh-var(--spacing-nav))] bg-canvas pb-28 pt-5'>
			<div className='mx-auto w-full max-w-md space-y-4'>
				<div className='px-4'>
					<AppBar
						title='Parkinglar'
						subtitle='Joy toping va bron qiling'
						onBack={() => router.back()}
						action={
							<IconButton
								label='Filtrlar'
								badge={filters.activeCount}
								onClick={() => setFiltersOpen(true)}
							>
								<SlidersHorizontal className='size-[18px]' />
							</IconButton>
						}
					/>
				</div>

				<div className='px-4'>
					<SearchField
						value={filters.query}
						onValueChange={filters.setQuery}
						placeholder='Parking nomi yoki manzil…'
						aria-label='Parking qidirish'
					/>
				</div>

				<div className='px-4'>
					<div className='relative overflow-hidden rounded-card-lg shadow-card'>
						<ParkingMap
							parkings={results.map(item => item.parking)}
							userLocation={location}
							selectedParkingId={selectedId ?? undefined}
							onSelect={id => setSelectedId(id)}
							className='h-[246px]'
						/>

						<div className='pointer-events-none absolute left-2.5 top-2.5 flex flex-col gap-2'>
							<IconButton
								label='Joylashuvimni topish'
								onClick={locate}
								className='pointer-events-auto'
							>
								<LocateFixed
									className={cn(
										'size-[18px] text-ink-2',
										status === 'loading' && 'animate-pulse',
									)}
								/>
							</IconButton>
							<IconButton
								label='Narxlarni ko‘rsatish'
								onClick={() => filters.setShowPrices(!filters.showPrices)}
								className={cn(
									'pointer-events-auto',
									filters.showPrices && 'bg-brand text-white',
								)}
							>
								<Tag className='size-[18px]' />
							</IconButton>
						</div>

						{results.length === 0 && (
							<div className='absolute inset-0 grid place-items-center bg-white/85 px-6 text-center'>
								<div>
									<p className='text-[14px] font-bold text-ink'>
										Hech narsa topilmadi
									</p>
									<Button
										size='sm'
										variant='primary'
										className='mt-3'
										onClick={filters.reset}
									>
										Filtrlarni tozalash
									</Button>
								</div>
							</div>
						)}
					</div>
				</div>

				<HorizontalRail className='gap-2 px-4'>
					{PARKING_CHIPS.map(chip => (
						<Chip
							key={chip.id}
							active={filters.chip === chip.id}
							onClick={() =>
								filters.setChip(filters.chip === chip.id ? 'all' : chip.id)
							}
						>
							{chip.label}
						</Chip>
					))}
				</HorizontalRail>

				{/* The occupancy band, off the map and onto the list — it is the
				    strongest filter here and belongs where the results are. */}
				<HorizontalRail className='gap-2 px-4'>
					{LOAD_BANDS.map(item => (
						<Chip
							key={item.id}
							active={filters.band === item.id}
							onClick={() =>
								filters.setBand(filters.band === item.id ? 'all' : item.id)
							}
						>
							<i className={cn('size-2 rounded-full', item.tone)} />
							{item.label}
						</Chip>
					))}
				</HorizontalRail>

				{activeReservation && (
					<div className='px-4'>
						<ActiveBookingBanner
							reservation={activeReservation}
							onNotify={toast.show}
						/>
					</div>
				)}

				<div className='px-4'>
					<SectionHeader
						title='Yaqin parkinglar'
						count={results.length}
						action={
							<span className='flex items-center gap-1'>
								<ArrowUpDown className='size-3.5' /> {sortLabel}
							</span>
						}
						onAction={() => setSortOpen(true)}
					/>
				</div>

				<div className='space-y-3 px-4'>
					{results.length ? (
						results.map(({ parking, km }) => (
							<ParkingCard
								key={parking.id}
								parking={parking}
								distance={km}
								onOpen={() => router.push(`/parking/${parking.id}`)}
								onBook={() => setBookingParkingId(parking.id)}
							/>
						))
					) : (
						<EmptyState
							icon={CircleParking}
							title='Parking topilmadi'
							text='Filtrlarni yumshatib ko‘ring yoki boshqa manzilni qidiring.'
							href='/home'
							action='Bosh sahifa'
						/>
					)}
				</div>

				<div className='px-4 pt-1'>
					<OccupancyForecastCard
						parkings={PARKINGS}
						selected={forecastParking}
						onSelect={setForecastId}
						onBook={setBookingParkingId}
					/>
				</div>
			</div>

			{sortOpen && (
				<BottomSheet title='Saralash' onClose={() => setSortOpen(false)}>
					<Card variant='bare'>
						{PARKING_SORTS.map((option, index) => (
							<button
								key={option.id}
								type='button'
								onClick={() => {
									filters.setSort(option.id)
									setSortOpen(false)
								}}
								className={cn(
									'flex w-full items-center justify-between px-3.5 py-3.5 text-left text-[14px]',
									index > 0 && 'border-t border-line',
									filters.sort === option.id
										? 'font-bold text-brand'
										: 'text-ink-2',
								)}
							>
								{option.label}
								{filters.sort === option.id && <span>✓</span>}
							</button>
						))}
					</Card>
				</BottomSheet>
			)}

			{filtersOpen && (
				<ParkingFiltersSheet
					advanced={filters.advanced}
					onChange={filters.setAdvanced}
					onReset={filters.reset}
					resultCount={results.length}
					onClose={() => setFiltersOpen(false)}
				/>
			)}

			<ParkingBookingSheet
				parkingId={bookingParkingId}
				onClose={() => setBookingParkingId(null)}
				onNotify={toast.show}
			/>

			<Toast open={toast.open} message={toast.payload ?? ''} />
		</div>
	)
}
