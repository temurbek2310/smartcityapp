'use client'

import {
	ChevronLeft,
	ChevronRight,
	LayoutList,
	LocateFixed,
	MapPin,
	Maximize2,
	Navigation,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'

import { CityMap, type CityMapHandle } from '@/components/map/city-map'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Chip } from '@/components/ui/chip'
import { HorizontalRail } from '@/components/ui/horizontal-rail'
import { IconButton } from '@/components/ui/icon-button'
import { IconTile } from '@/components/ui/icon-tile'
import { SearchField } from '@/components/ui/search-field'
import { Toast } from '@/components/ui/toast'
import { PARKINGS } from '@/data/parkings'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/cn'
import { formatDistance } from '@/lib/format'
import { DirectionsSheet } from '@/components/navigation/directions-sheet'
import { useDirections } from '@/hooks/use-directions'
import { useRefreshSignal } from '@/components/ui/pull-to-refresh'
import { liveAvailabilityAll } from '@/lib/live-availability'
import {
	MAP_CATEGORIES,
	buildMapObjects,
	mapObjectKey,
	type MapObject,
	type MapCatalogKind,
} from '@/lib/map-objects'
import { useUserLocation } from '@/lib/use-user-location'

// City Goo's ninth screen. Everything the app knows how to put on a map —
// places, parkings, queue organisations and events — on one surface, with the
// same set readable either as pins or as a list.
export default function MapPage() {
	const router = useRouter()
	const toast = useToast<string>()
	const directions = useDirections()
	const mapHandle = useRef<CityMapHandle>(null)

	const [category, setCategory] = useState<MapCatalogKind | 'all'>('all')
	const [query, setQuery] = useState('')
	const [asList, setAsList] = useState(false)
	const [selectedKey, setSelectedKey] = useState<string | null>(null)
	const [locateRevision, setLocateRevision] = useState(0)
	const carouselRef = useRef<HTMLDivElement>(null)

	const { location, status, locate } = useUserLocation()
	useEffect(() => {
		locate()
	}, [locate])

	const { tick } = useRefreshSignal()
	const parkings = useMemo(() => liveAvailabilityAll(PARKINGS, tick), [tick])

	const origin = status === 'ready' || status === 'fallback' ? location : undefined

	const objects = useMemo(
		() => buildMapObjects({ parkings, category, query, origin }),
		[parkings, category, query, origin],
	)

	// Counts on the chips are of the unfiltered-by-category set, so switching
	// tabs never surprises you with a number that was not on the chip.
	const counts = useMemo(() => {
		const all = buildMapObjects({ parkings, query, origin })
		return {
			all: all.length,
			place: all.filter(item => item.kind === 'place').length,
			parking: all.filter(item => item.kind === 'parking').length,
			queue: all.filter(item => item.kind === 'queue').length,
			event: all.filter(item => item.kind === 'event').length,
		}
	}, [parkings, query, origin])

	useEffect(() => {
		carouselRef.current?.querySelector('[data-selected="true"]')?.scrollIntoView({
			behavior: 'smooth', inline: 'start', block: 'nearest',
		})
	}, [selectedKey, asList])

	function pick(object: MapObject) {
		setSelectedKey(mapObjectKey(object))
		mapHandle.current?.flyTo(object)
	}

	function routeTo(object: MapObject) {
		directions.open({ from: 'mapObject', key: mapObjectKey(object) })
	}

	// Full-bleed, but stopping at the bottom nav: City Goo keeps the tab bar on
	// this screen (TAB_OF.map = 'home'), and the card carousel has to clear it.
	return (
		<div className='fixed inset-x-0 top-0 bottom-[var(--spacing-nav)] z-30 mx-auto flex w-full max-w-md flex-col bg-canvas'>
			<div className='shrink-0 space-y-2.5 px-4 pb-3 pt-[max(1rem,env(safe-area-inset-top))]'>
				<div className='flex items-center gap-2.5'>
					<IconButton label='Ortga' onClick={() => router.back()}>
						<ChevronLeft className='size-5 text-ink-2' />
					</IconButton>

					<SearchField
						value={query}
						onValueChange={setQuery}
						placeholder='Joy, parking, manzil…'
						aria-label='Xaritadan qidirish'
						className='min-w-0 flex-1'
					/>

					<IconButton
						label={asList ? 'Xaritada ko‘rish' : 'Ro‘yxatda ko‘rish'}
						onClick={() => setAsList(value => !value)}
						className={cn(asList && 'bg-brand')}
					>
						{asList ? (
							<MapPin className='size-[18px] text-white' />
						) : (
							<LayoutList className='size-[18px] text-ink-2' />
						)}
					</IconButton>
				</div>

				<HorizontalRail className='gap-2'>
					{MAP_CATEGORIES.map(item => (
						<Chip
							key={item.id}
							active={category === item.id}
							onClick={() => {
								setCategory(item.id)
								setSelectedKey(null)
							}}
						>
							{item.label} · {counts[item.id]}
						</Chip>
					))}
				</HorizontalRail>
			</div>

			{asList ? (
				<div className='min-h-0 flex-1 space-y-2 overflow-y-auto px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]'>
					{objects.length ? (
						objects.map(object => {
							const Icon = object.icon
							return (
								<button
									key={mapObjectKey(object)}
									type='button'
									onClick={() => {
										setSelectedKey(mapObjectKey(object))
										setAsList(false)
									}}
									className='flex w-full items-center gap-3 rounded-card-lg bg-card p-3 text-left shadow-card'
								>
									<IconTile tone='bg-card-2'>
										<Icon className='size-[18px]' style={{ color: object.color }} />
									</IconTile>
									<span className='min-w-0 flex-1'>
										<span className='flex items-baseline justify-between gap-2'>
											<span className='truncate text-[14px] font-semibold text-ink'>
												{object.title}
											</span>
											<span className='shrink-0 text-[11px] text-ink-3'>
												{formatDistance(object.distanceKm)}
											</span>
										</span>
										<span className='mt-0.5 block truncate text-[11.5px] text-ink-3'>
											{object.meta}
										</span>
										<span className='mt-0.5 block truncate text-[11px] text-ink-3'>
											{object.address}
										</span>
									</span>
									<ChevronRight className='size-4 shrink-0 text-ink-3' />
								</button>
							)
						})
					) : (
						<Card className='mt-6 text-center'>
							<p className='text-[14px] font-bold text-ink'>Hech narsa topilmadi</p>
							<Button
								variant='primary'
								className='mt-3'
								onClick={() => {
									setQuery('')
									setCategory('all')
								}}
							>
								Barchasini ko‘rsatish
							</Button>
						</Card>
					)}
				</div>
			) : (
				<div className='relative min-h-0 flex-1'>
					<CityMap
						objects={objects}
						selectedKey={selectedKey}
						onSelect={pick}
						userLocation={origin}
						handleRef={mapHandle}
						viewportKey={`${category}:${query}`}
						locateRevision={locateRevision}
						bottomPadding={190}
						className='size-full'
					/>

					<p className='pointer-events-none absolute left-3 top-3 z-20 rounded-[9px] bg-white/95 px-2.5 py-1.5 text-[11px] font-semibold text-ink-2 shadow-card'>
						Xaritada {objects.length} ta obyekt
					</p>

					<div className='pointer-events-none absolute right-3 top-3 z-20 flex flex-col gap-2'>
						<IconButton
							label='Joylashuvim'
							onClick={() => {
								locate()
								setLocateRevision(value => value + 1)
							}}
							className='pointer-events-auto'
						>
							<LocateFixed
								className={cn(
									'size-[18px] text-brand',
									status === 'loading' && 'citygo-refresh-spinner is-refreshing',
								)}
							/>
						</IconButton>
						<IconButton
							label='Hammasini kadrga sig‘dirish'
							onClick={() => {
								mapHandle.current?.fitAll()
								toast.show(`${objects.length} ta obyekt kadrda`)
							}}
							className='pointer-events-auto'
						>
							<Maximize2 className='size-[18px] text-ink-2' />
						</IconButton>
					</div>

					{objects.length === 0 && <Card className='absolute inset-x-3 bottom-3 z-20 text-center'>
						<p className='text-sm text-ink'>Hech narsa topilmadi</p>
						<Button className='mt-2' onClick={() => { setQuery(''); setCategory('all') }}>Barchasini ko‘rsatish</Button>
					</Card>}
					{objects.length > 0 && (
						<div ref={carouselRef} className='absolute inset-x-0 bottom-0 z-20 pb-[max(.75rem,env(safe-area-inset-bottom))]'>
							<HorizontalRail className='gap-2.5 px-3 pt-10'>
								{objects.map(object => {
									const key = mapObjectKey(object)
									const Icon = object.icon
									return (
										<Card
											key={key}
											data-selected={key === selectedKey}
											onClick={() => pick(object)}
											className={cn(
												'w-[248px] shrink-0 cursor-pointer',
												key === selectedKey && 'ring-[1.5px] ring-brand',
											)}
										>
											<div className='flex items-start justify-between gap-2'>
												<div className='flex min-w-0 items-center gap-2.5'>
													<IconTile size={32} tone='bg-card-2'>
														<Icon
															className='size-4'
															style={{ color: object.color }}
														/>
													</IconTile>
													<div className='min-w-0'>
														<p className='truncate text-[13.5px] font-extrabold text-ink'>
															{object.title}
														</p>
														<p className='text-[11px] text-ink-3'>
															{formatDistance(object.distanceKm)}
														</p>
													</div>
												</div>
												{object.tag && (
													<span
														className='shrink-0 rounded-[7px] px-2 py-1 text-[10.5px] font-extrabold'
														style={{
															color: object.color,
															backgroundColor: `${object.color}1f`,
														}}
													>
														{object.tag}
													</span>
												)}
											</div>

											<p className='mt-2 truncate text-[11.5px] text-ink-3'>
												{object.meta}
											</p>

											<div className='mt-2.5 grid grid-cols-2 gap-2'>
												<Button
													size='sm'
													variant='outline'
													onClick={event => {
														event.stopPropagation()
														routeTo(object)
													}}
												>
													<Navigation className='size-3.5' /> Yo‘nalish
												</Button>
												<Button
													size='sm'
													variant='primary'
													onClick={event => {
														event.stopPropagation()
														router.push(object.href)
													}}
												>
													Ochish
												</Button>
											</div>
										</Card>
									)
								})}
							</HorizontalRail>
						</div>
					)}
				</div>
			)}

			<DirectionsSheet
				destinationId={directions.destinationId}
				onClose={directions.close}
			/>

			<Toast open={toast.open} message={toast.payload ?? ''} />
		</div>
	)
}
