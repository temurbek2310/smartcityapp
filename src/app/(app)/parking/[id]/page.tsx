'use client'

import {
	BatteryCharging,
	Bike,
	Camera,
	Car,
	CircleParking,
	Clock3,
	Droplets,
	Heart,
	MapPin,
	Navigation,
	ScanLine,
	Share2,
	ShieldCheck,
	Star,
	TriangleAlert,
	Umbrella,
	type LucideIcon,
} from 'lucide-react'
import { notFound, useParams, useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'

import { DirectionsSheet } from '@/components/navigation/directions-sheet'
import { BayGrid } from '@/components/parking/bay-grid'
import { ParkingBookingSheet } from '@/components/parking/parking-booking-sheet'
import { AppBar } from '@/components/ui/app-bar'
import { Badge } from '@/components/ui/badge'
import { BarChart } from '@/components/ui/bar-chart'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Chip } from '@/components/ui/chip'
import { IconTile } from '@/components/ui/icon-tile'
import { Toast } from '@/components/ui/toast'
import { useApp } from '@/context/app-context'
import { PARKINGS, getParking } from '@/data/parkings'
import { useDirections } from '@/hooks/use-directions'
import { useBookingMeta } from '@/hooks/use-booking-meta'
import { useToast } from '@/hooks/use-toast'
import { occupancyTone, parkingAvailability } from '@/lib/availability'
import { isBaySelectable, type BayState } from '@/lib/bay-map'
import { cn } from '@/lib/cn'
import { formatUZS } from '@/lib/format'
import { occupancyForecast, peakForecastSlot } from '@/lib/occupancy-forecast'
import type { ParkingAmenity } from '@/lib/types'

const AMENITY_ICONS: Record<ParkingAmenity, LucideIcon> = {
	CCTV: Camera,
	'EV Charging': BatteryCharging,
	Valet: Car,
	Covered: Umbrella,
	Accessible: ShieldCheck,
	Security: ShieldCheck,
	'Bike Parking': Bike,
	'Car Wash': Droplets,
}

const AMENITY_LABELS: Record<ParkingAmenity, string> = {
	CCTV: 'Videokuzatuv',
	'EV Charging': 'EV quvvatlash',
	Valet: 'Valet',
	Covered: 'Yopiq',
	Accessible: 'Nogironlar uchun',
	Security: 'Qo‘riqlanadi',
	'Bike Parking': 'Velosiped',
	'Car Wash': 'Avtomoyka',
}

// Every amenity the catalog can carry, not just this lot's. City Goo dims the
// missing ones rather than hiding them, which is what makes two lots
// comparable at a glance.
const ALL_AMENITIES: ParkingAmenity[] = [
	'Covered',
	'EV Charging',
	'Bike Parking',
	'Accessible',
	'Security',
	'CCTV',
	'Car Wash',
	'Valet',
]

const REPORT_REASONS: { label: string; icon: LucideIcon }[] = [
	{ label: 'Shlagbaum ochilmayapti', icon: TriangleAlert },
	{ label: 'Joyni boshqa avto egallagan', icon: Car },
	{ label: 'Narx noto‘g‘ri ko‘rsatilgan', icon: CircleParking },
	{ label: 'Bo‘sh joy yo‘q', icon: CircleParking },
	{ label: 'Boshqa sabab', icon: TriangleAlert },
]

export default function ParkingDetailPage() {
	const params = useParams<{ id: string }>()
	const router = useRouter()
	const { favorites, toggleFavorite, reservations } = useApp()
	const toast = useToast<string>()
	const directions = useDirections()

	const [level, setLevel] = useState(1)
	const [selectedBay, setSelectedBay] = useState<string | null>(null)
	const [reportOpen, setReportOpen] = useState(false)
	const [bookingOpen, setBookingOpen] = useState(false)

	const parking = getParking(params.id)
	const forecast = useMemo(
		() => (parking ? occupancyForecast(parking) : []),
		[parking],
	)

	const heldReservation = reservations.find(
		item =>
			item.parkingId === params.id &&
			(item.status === 'active' || item.status === 'reserved'),
	)
	const heldMeta = useBookingMeta(heldReservation?.id)

	if (!parking) notFound()

	const { percent, full, tone } = parkingAvailability(parking)
	const peak = peakForecastSlot(forecast)
	const favorite = favorites.includes(parking.id)

	// The bay this user already holds here, so the plan can mark it rather
	// than offering it as a free choice. Bay/level live beside the reservation
	// under their own key, not on the Reservation itself.
	const heldBay = heldMeta?.level === level ? heldMeta.bay : null

	const alternative = PARKINGS.find(
		item =>
			item.city === parking.city &&
			item.id !== parking.id &&
			item.availableSpaces > 0,
	)

	const tariffs = [
		{ label: 'Soat', value: parking.pricePerHour },
		{ label: 'Sutka', value: parking.pricePerDay },
		{ label: 'Oy', value: parking.pricePerMonth },
	]

	function pickBay(bay: string, state: BayState) {
		if (state === 'mine') return toast.show('Bu sizning bron qilgan joyingiz')
		if (!isBaySelectable(state)) return toast.show('Bu joy band')

		if (selectedBay === bay) return setSelectedBay(null)

		setSelectedBay(bay)
		toast.show(
			state === 'ev'
				? `${bay} tanlandi — EV quvvatlash bilan`
				: state === 'accessible'
					? `${bay} tanlandi — nogironlar uchun`
					: `${bay} joyi tanlandi`,
		)
	}

	async function share() {
		const text = `${parking!.name} · ${parking!.address}\n${window.location.origin}/parking/${parking!.id}`
		try {
			await navigator.clipboard.writeText(text)
			toast.show('Havola nusxalandi')
		} catch {
			// Clipboard needs a secure context and permission; the address is on
			// screen either way.
			toast.show(text)
		}
	}

	const actions = [
		{
			label: 'Yo‘nalish',
			icon: Navigation,
			onClick: () => directions.open({ from: 'parking', parkingId: parking.id }),
		},
		{
			label: favorite ? 'Sevimlida' : 'Sevimliga',
			icon: Heart,
			on: favorite,
			onClick: () => {
				toggleFavorite(parking.id)
				toast.show(
					favorite
						? 'Sevimlilardan olib tashlandi'
						: `«${parking.name}» sevimlilarga qo‘shildi`,
				)
			},
		},
		{ label: 'Ulashish', icon: Share2, onClick: share },
		{
			label: 'Xabar berish',
			icon: TriangleAlert,
			onClick: () => setReportOpen(true),
		},
	]

	return (
		<div className='-mx-5 -mt-6 min-h-[calc(100dvh-var(--spacing-nav))] bg-canvas pb-28 pt-5'>
			<div className='mx-auto w-full max-w-md space-y-3'>
				<div className='px-4'>
					<AppBar
						title='Parking'
						subtitle={parking.district}
						onBack={() => router.back()}
					/>
				</div>

				<div className='px-4'>
					<Card variant='bare'>
						<div
							className={cn(
								'flex h-[140px] items-end justify-between bg-linear-to-br p-3',
								parking.accent,
							)}
						>
							<span
								className={cn(
									'rounded-[7px] bg-white/95 px-2 py-1 text-[11.5px] font-extrabold',
									tone.text,
								)}
							>
								{full
									? 'Bo‘sh joy yo‘q'
									: `${parking.totalSpaces} dan ${parking.availableSpaces} bo‘sh`}
							</span>
							<span className='rounded-[7px] bg-white/95 px-2 py-1 text-[11.5px] font-bold text-ink-2'>
								{parking.levels} daraja
							</span>
						</div>

						<div className='p-3.5'>
							<h2 className='text-[20px] font-black tracking-[-0.02em] text-ink'>
								{parking.name}
							</h2>

							<div className='mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[13px]'>
								<span className='flex items-center gap-1 font-bold text-ink'>
									<Star className='size-3.5 fill-star text-star' />
									{parking.rating}
								</span>
								<span className='text-ink-3'>({parking.reviewCount} sharh)</span>
								<span className='text-ink-3'>{parking.city}</span>
							</div>

							<p className='mt-2 flex items-center gap-1.5 text-[13px] text-ink-2'>
								<MapPin className='size-3.5 shrink-0 text-ink-3' />
								{parking.address}
							</p>
							<p className='mt-1 flex items-center gap-1.5 text-[13px] text-ink-2'>
								<Clock3 className='size-3.5 shrink-0 text-ink-3' />
								{parking.workingHours}
								{parking.maxHeightM !== null &&
									` · balandligi ${parking.maxHeightM} m gacha`}
							</p>

							<p className='mt-2.5 text-[12.5px] leading-5 text-ink-2'>
								{parking.description}
							</p>
						</div>
					</Card>
				</div>

				<div className='px-4'>
					<Card>
						<div className='flex items-center justify-between gap-3'>
							<p className='text-[14px] font-bold text-ink'>Tariflar</p>
							<Badge tone='brand'>
								{parking.plateRecognition ? (
									<>
										<ScanLine className='size-3' /> Raqam bo‘yicha kirish
									</>
								) : (
									'Kirishda talon'
								)}
							</Badge>
						</div>

						<div className='mt-3 grid grid-cols-3 gap-2'>
							{tariffs.map(tariff => (
								<div
									key={tariff.label}
									className='rounded-xl bg-card-2 px-2 py-3 text-center'
								>
									<p className='text-[14px] font-black text-ink'>
										{tariff.value == null ? '—' : tariff.value === 0 ? 'Bepul' : formatUZS(tariff.value)}
									</p>
									<p className='mt-1 text-[11px] text-ink-3'>{tariff.label}</p>
								</div>
							))}
						</div>

						<p className='mt-3 text-[11.5px] leading-5 text-ink-3'>
							{parking.pricePerHour
								? 'Birinchi 15 daqiqa bepul. To‘lov chiqishda yoki bron qilishda oldindan olinadi.'
								: 'Parking bepul — joyni oldindan bron qilish mumkin.'}
						</p>
					</Card>
				</div>

				<div className='px-4'>
					<Card>
						<div className='flex items-center justify-between gap-3'>
							<p className='text-[14px] font-bold text-ink'>Joylar sxemasi</p>
							<div className='flex gap-1.5'>
								{Array.from({ length: parking.levels }, (_, index) => (
									<Chip
										key={index}
										active={level === index + 1}
										onClick={() => {
											setLevel(index + 1)
											setSelectedBay(null)
										}}
										className='h-7 px-2.5 text-[11.5px]'
									>
										{index + 1}
									</Chip>
								))}
							</div>
						</div>

						<div className='mt-3'>
							<BayGrid
								parking={parking}
								level={level}
								selectedBay={selectedBay}
								heldBay={heldBay}
								onSelect={pickBay}
							/>
						</div>
					</Card>
				</div>

				<div className='px-4'>
					<Card>
						<p className='text-[14px] font-bold text-ink'>Jihozlar</p>
						<div className='mt-3 grid grid-cols-4 gap-2'>
							{ALL_AMENITIES.map(amenity => {
								const Icon = AMENITY_ICONS[amenity]
								const count =
									amenity === 'EV Charging'
										? parking.evChargers
										: amenity === 'Accessible'
											? parking.accessibleSpaces
											: 0

								// Where the catalog carries a count, the count decides. The
								// two sources disagree — magic-city has evChargers: 4 but no
								// 'EV Charging' in amenities — and the floor plan already
								// draws those four bays, so hiding them here would make the
								// same screen contradict itself.
								const has =
									amenity === 'EV Charging' || amenity === 'Accessible'
										? count > 0
										: parking.amenities.includes(amenity)

								return (
									<div
										key={amenity}
										className={cn(
											'flex flex-col items-center gap-1.5 text-center',
											!has && 'opacity-35',
										)}
									>
										<IconTile
											size={38}
											tone={has ? 'bg-brand-50 text-brand' : 'bg-card-2 text-ink-3'}
										>
											<Icon className='size-[18px]' />
										</IconTile>
										<span className='text-[10px] font-semibold leading-tight text-ink-2'>
											{AMENITY_LABELS[amenity]}
											{has && count > 0 && (
												<>
													<br />
													<b className='text-brand'>{count} ta</b>
												</>
											)}
										</span>
									</div>
								)
							})}
						</div>
					</Card>
				</div>

				<div className='px-4'>
					<Card>
						<p className='text-[14px] font-bold text-ink'>Kirish va chiqish</p>
						<p className='mt-2 text-[13px] leading-5 text-ink-2'>
							{parking.entranceNote}
						</p>

						<div className='my-3 h-px bg-line' />

						<p className='text-[14px] font-bold text-ink'>To‘lov</p>
						<div className='mt-2 flex flex-wrap gap-1.5'>
							{parking.paymentMethods.map(method => (
								<span
									key={method}
									className='rounded-[9px] border border-line bg-card-2 px-2.5 py-1 text-[11.5px] font-semibold text-ink-2'
								>
									{method}
								</span>
							))}
						</div>
					</Card>
				</div>

				<div className='px-4'>
					<Card>
						<div className='flex items-center justify-between gap-3'>
							<p className='text-[14px] font-bold text-ink'>
								Soatlar bo‘yicha bandlik
							</p>
							<Badge tone={peak.percent >= 90 ? 'bad' : 'warn'}>
								Eng gavjum {peak.percent}%
							</Badge>
						</div>
						<BarChart
							className='mt-3'
							height={74}
							bars={forecast.map(point => ({
								label: point.label === 'Hozir' ? 'hozir' : point.label.slice(0, 2),
								value: point.percent,
								tone: occupancyTone(point.percent),
							}))}
						/>
						<p className='mt-2 text-[11.5px] text-ink-3'>
							Hozir {100 - percent}% band.
						</p>
					</Card>
				</div>

				<div className='px-4'>
					<div className='grid grid-cols-4 gap-2'>
						{actions.map(action => (
							<button
								key={action.label}
								type='button'
								onClick={action.onClick}
								className='flex flex-col items-center gap-1.5 rounded-card-lg bg-card p-3 text-center shadow-card'
							>
								<IconTile size={38} tone='bg-brand-50 text-brand'>
									<action.icon
										className={cn('size-[18px]', action.on && 'fill-brand')}
									/>
								</IconTile>
								<span className='text-[10px] font-semibold text-ink-2'>
									{action.label}
								</span>
							</button>
						))}
					</div>
				</div>

				{full && alternative && (
					<div className='px-4'>
						<Card variant='flat' className='bg-warn-bg'>
							<p className='text-[13px] leading-5 text-ink-2'>
								<b className='text-ink'>Parking to‘lgan.</b> Yaqin muqobil —{' '}
								{alternative.name}, {alternative.availableSpaces} joy bo‘sh.
							</p>
							<Button
								variant='outline'
								block
								className='mt-3'
								onClick={() => router.push(`/parking/${alternative.id}`)}
							>
								{alternative.name}ni ochish
							</Button>
						</Card>
					</div>
				)}

				<div className='px-4 pt-1'>
					<Button
						variant='primary'
						block
						disabled={full}
						onClick={() => setBookingOpen(true)}
					>
						{full
							? 'Bo‘sh joy yo‘q'
							: selectedBay
								? `${selectedBay} joyini bron qilish`
								: 'Joy bron qilish'}
					</Button>
				</div>
			</div>

			{reportOpen && (
				<BottomSheet
					title='Muammo haqida xabar berish'
					onClose={() => setReportOpen(false)}
				>
					<div className='space-y-2'>
						{REPORT_REASONS.map(reason => (
							<button
								key={reason.label}
								type='button'
								onClick={() => {
									setReportOpen(false)
									toast.show('Xabar operatorga yuborildi')
								}}
								className='flex w-full items-center gap-3 rounded-card-lg bg-card p-3 text-left shadow-card'
							>
								<IconTile tone='bg-card-2 text-brand'>
									<reason.icon className='size-[18px]' />
								</IconTile>
								<span className='flex-1 text-[14px] font-semibold text-ink'>
									{reason.label}
								</span>
							</button>
						))}
					</div>
				</BottomSheet>
			)}

			<ParkingBookingSheet
				parkingId={bookingOpen ? parking.id : null}
				initialBay={selectedBay}
				initialLevel={level}
				onClose={() => setBookingOpen(false)}
				onNotify={toast.show}
			/>

			<DirectionsSheet
				destinationId={directions.destinationId}
				onClose={directions.close}
			/>

			<Toast open={toast.open} message={toast.payload ?? ''} />
		</div>
	)
}
