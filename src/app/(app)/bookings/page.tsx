'use client'

import {
	CalendarDays,
	ChevronRight,
	CircleParking,
	Repeat,
	Share2,
	Stethoscope,
	Ticket,
	Users,
	X,
	type LucideIcon,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useMemo, useState, type KeyboardEvent, type MouseEvent } from 'react'

import { ServiceBookingSheet } from '@/components/booking/service-booking-sheet'
import { TableBookingFlow } from '@/components/booking/table-booking-flow'
import { ParkingBookingSheet } from '@/components/parking/parking-booking-sheet'
import { Badge, type BadgeTone } from '@/components/ui/badge'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { IconTile } from '@/components/ui/icon-tile'
import { KeyValue, KeyValueList } from '@/components/ui/key-value'
import { QrImage } from '@/components/ui/qr-image'
import { SectionHeader } from '@/components/ui/section-header'
import { SegmentedTabs } from '@/components/ui/segmented-tabs'
import { Toast } from '@/components/ui/toast'
import { useApp } from '@/context/app-context'
import { useBookingMetaMap } from '@/hooks/use-booking-meta'
import { useToast } from '@/hooks/use-toast'
import { bookingRows, isOpen, type BookingRow } from '@/lib/bookings'
import { cn } from '@/lib/cn'
import type { BookingKind, ServiceBookingKind } from '@/lib/types'

const KIND_ICON: Record<BookingKind, LucideIcon> = {
	parking: CircleParking,
	queue: Users,
	table: CalendarDays,
	cinema: Ticket,
	clinic: Stethoscope,
	event: Ticket,
}

const STATUS_TONE: Record<BookingRow['status'], BadgeTone> = {
	active: 'ok',
	upcoming: 'brand',
	done: 'gray',
	cancelled: 'gray',
}

const NEW_BOOKING: {
	id: BookingKind
	label: string
	hint: string
	tone: string
}[] = [
	{ id: 'parking', label: 'Parking', hint: 'Kerakli manzilda joy', tone: 'bg-brand-50 text-brand' },
	{ id: 'queue', label: 'Elektron navbat', hint: 'Raqamni oldindan oling', tone: 'bg-ok-bg text-ok' },
	{ id: 'table', label: 'Stolik', hint: 'Restoran va parking birga', tone: 'bg-warn-bg text-warn' },
	{ id: 'cinema', label: 'Chiptalar', hint: 'Kino va tadbirlar', tone: 'bg-info-bg text-info' },
	{ id: 'clinic', label: 'Shifokor qabuli', hint: 'Klinikaga yozilish', tone: 'bg-bad-bg text-bad' },
]

export default function BookingsPage() {
	const router = useRouter()
	const toast = useToast<string>()
	const app = useApp()
	const { cancelReservation, cancelQueueTicket, cancelServiceBooking } = app

	const [tab, setTab] = useState<'open' | 'history'>('open')
	const [qrRow, setQrRow] = useState<BookingRow | null>(null)
	const [cancelRow, setCancelRow] = useState<BookingRow | null>(null)
	const [serviceSheet, setServiceSheet] = useState<{
		kind: ServiceBookingKind
		refId: string
	} | null>(null)
	const [parkingSheet, setParkingSheet] = useState<string | null>(null)
	// The generic «Stolik» shortcut, which has to ask which restaurant first.
	const [tableFlowOpen, setTableFlowOpen] = useState(false)

	const rows = useMemo(() => bookingRows(app), [app])
	const open = rows.filter(isOpen)
	const history = rows.filter(row => !isOpen(row))
	const list = tab === 'open' ? open : history

	// Bay and level for the parking rows, so a summary card can say which
	// space is being held without opening the booking.
	const parkingMeta = useBookingMetaMap(
		rows.filter(row => row.kind === 'parking').map(row => row.id),
	)

	// Where tapping a card goes. The kinds with a screen of their own open it;
	// the light service bookings have none, so their QR sheet is the detail
	// view and carries the actions that used to sit on the card.
	function openRow(row: BookingRow) {
		if (isOpen(row) && row.qrValue) setQrRow(row)
		else if (row.href) router.push(row.href)
	}

	function canOpen(row: BookingRow) {
		return Boolean(row.href) || (isOpen(row) && Boolean(row.qrValue))
	}

	async function share(row: BookingRow) {
		const text = `${row.title} · ${row.code}`
		try {
			await navigator.clipboard.writeText(text)
			toast.show('Bron nusxalandi')
		} catch {
			// Clipboard needs a secure context and permission; the code is on
			// screen either way.
			toast.show(text)
		}
	}

	function cancel(row: BookingRow) {
		// The row knows whether the store will actually honour this. Without
		// the guard an active parking session reported success and carried on
		// running, because cancelReservation() ignores anything but 'reserved'.
		if (!row.cancellable) {
			setCancelRow(null)
			toast.show('Bu bronni bekor qilib bo‘lmaydi')
			return
		}
		if (row.kind === 'parking') cancelReservation(row.id)
		else if (row.kind === 'queue') cancelQueueTicket(row.id)
		else cancelServiceBooking(row.id)
		setCancelRow(null)
		toast.show('Bron bekor qilindi')
	}

	function repeat(row: BookingRow) {
		if (!row.repeat) return
		if (row.repeat.kind === 'parking') setParkingSheet(row.repeat.refId)
		else if (row.repeat.kind === 'queue') router.push('/queues')
		else
			setServiceSheet({
				kind: row.repeat.kind as ServiceBookingKind,
				refId: row.repeat.refId,
			})
	}

	function startNew(kind: BookingKind) {
		if (kind === 'parking') return router.push('/parking')
		if (kind === 'queue') return router.push('/queues')
		// Same generic shortcut as Home's services rail, same flow: ask which
		// restaurant instead of picking one on the customer's behalf.
		if (kind === 'table') return setTableFlowOpen(true)
		// The service sheet needs somewhere to book; Home's place catalog is
		// where these live, so send the matching demo venue.
		const refId = kind === 'cinema' ? 'cinema-magic' : 'medical-plaza'
		setServiceSheet({ kind: kind as ServiceBookingKind, refId })
	}

	return (
		<div className='space-y-5'>
			<div>
				<h1 className='text-[22px] font-black tracking-[-0.02em] text-ink'>
					Bronlar
				</h1>
				<p className='mt-1 text-[12.5px] text-ink-3'>
					Barcha bronlaringiz bir joyda
				</p>
			</div>

			<SegmentedTabs
				items={[
					{ id: 'open' as const, label: 'Faol', count: open.length },
					{ id: 'history' as const, label: 'Tarix', count: history.length },
				]}
				value={tab}
				onChange={setTab}
			/>

			<div className='space-y-3'>
				{list.length ? (
					list.map(row => {
						const Icon = KIND_ICON[row.kind]
						const live = isOpen(row)
						const meta = row.kind === 'parking' ? parkingMeta[row.id] : undefined
						const openable = canOpen(row)
						const repeatable = !live && row.status !== 'cancelled'
						return (
							<Card
								key={row.id}
								as='article'
								{...(openable && {
									role: 'button',
									tabIndex: 0,
									'aria-label': `${row.title} — ${row.statusLabel}. Batafsil`,
									onClick: () => openRow(row),
									onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
										// Only the card's own key presses open it. A nested
										// «Takrorlash» activates on the same keys and its
										// keydown bubbles here, so without this the card
										// would navigate out from under the sheet it opened.
										if (event.target !== event.currentTarget) return
										if (event.key === 'Enter' || event.key === ' ') {
											event.preventDefault()
											openRow(row)
										}
									},
								})}
								className={cn(
									row.status === 'active' && 'border-[1.5px] border-brand',
									openable && 'cursor-pointer text-left transition active:scale-[0.99]',
								)}
							>
								<div className='flex items-start justify-between gap-3'>
									<div className='flex min-w-0 items-start gap-3'>
										<IconTile
											tone={
												row.status === 'active'
													? 'bg-ok-bg text-ok'
													: row.status === 'upcoming'
														? 'bg-brand-50 text-brand'
														: 'bg-card-2 text-ink-2'
											}
										>
											<Icon className='size-[18px]' />
										</IconTile>
										<div className='min-w-0'>
											<p className='truncate text-[15px] font-extrabold text-ink'>
												{row.title}
											</p>
											<p className='mt-0.5 truncate text-[11.5px] text-ink-3'>
												{row.subtitle}
											</p>
										</div>
									</div>

									<div className='shrink-0 text-right'>
										<Badge tone={STATUS_TONE[row.status]}>
											{row.statusLabel}
										</Badge>
										<p className='mt-1.5 font-mono text-[10.5px] text-ink-3'>
											{row.code}
										</p>
									</div>
								</div>

								<div className='mt-3 flex items-center justify-between gap-3 text-[11.5px]'>
									<span className='text-ink-3'>{row.whenLabel}</span>
									{row.amountLabel && (
										<span className='font-extrabold text-ink'>
											{row.amountLabel}
										</span>
									)}
								</div>

								{/* Only parking holds a named space, and only once the
								    booking sheet has written one. */}
								{meta && (
									<p className='mt-1 text-[11.5px] text-ink-3'>
										{meta.bay} · {meta.level}-daraja
									</p>
								)}

								{/* Summary only. Opening, sharing, cancelling and leaving all
								    live on the detail screen this card points at — an equal
								    «Bekor» next to «Ochish» made the list read as a control
								    panel and put a destructive action one mistap away. */}
								{(repeatable || openable) && (
									<div
										className={cn(
											'mt-3 flex items-center gap-3',
											repeatable ? 'justify-between' : 'justify-end',
										)}
									>
										{repeatable && (
											<Button
												size='sm'
												variant='outline'
												onPointerDown={event => event.stopPropagation()}
												onClick={(event: MouseEvent<HTMLButtonElement>) => {
													// Nested in a clickable card: without this the
													// card would navigate away from the sheet.
													event.stopPropagation()
													repeat(row)
												}}
											>
												<Repeat className='size-3.5' /> Takrorlash
											</Button>
										)}
										{openable && (
											// The card itself is the control, and its aria-label
											// already ends in «Batafsil»; this is the visible hint
											// that it is one.
											<span
												aria-hidden
												className='inline-flex items-center gap-0.5 text-[11.5px] font-semibold text-ink-3'
											>
												Batafsil
												<ChevronRight className='size-3.5' />
											</span>
										)}
									</div>
								)}
							</Card>
						)
					})
				) : (
					<EmptyState
						icon={CalendarDays}
						title={tab === 'open' ? 'Faol bron yo‘q' : 'Tarix bo‘sh'}
						text={
							tab === 'open'
								? 'Parking bron qiling, navbat oling yoki stol band qiling — hammasi shu yerda ko‘rinadi.'
								: 'Yakunlangan va bekor qilingan bronlar shu yerda saqlanadi.'
						}
						href='/parking'
						action='Parking topish'
					/>
				)}
			</div>

			<SectionHeader title='Yangi bron' />
			<div className='space-y-2'>
				{NEW_BOOKING.map(item => {
					const Icon = KIND_ICON[item.id]
					return (
						<button
							key={item.id}
							type='button'
							onClick={() => startNew(item.id)}
							className='flex w-full items-center gap-3 rounded-card-lg bg-card p-3 text-left shadow-card'
						>
							<IconTile tone={item.tone}>
								<Icon className='size-[18px]' />
							</IconTile>
							<span className='min-w-0 flex-1'>
								<span className='block truncate text-[14px] font-semibold text-ink'>
									{item.label}
								</span>
								<span className='mt-0.5 block truncate text-[11px] text-ink-3'>
									{item.hint}
								</span>
							</span>
							<ChevronRight className='size-4 shrink-0 text-ink-3' />
						</button>
					)
				})}
			</div>

			<Card variant='flat'>
				<p className='text-[11.5px] leading-5 text-ink-3'>
					Joyni bron vaqtidan keyin 15 daqiqa ushlab turamiz. Bir soat oldin
					bepul bekor qilish mumkin. Agar joy bo‘lmasa, to‘lovni qaytaramiz.
				</p>
			</Card>

			{qrRow && (
				<BottomSheet title={qrRow.title} onClose={() => setQrRow(null)}>
					<Card className='text-center'>
						<div className='mx-auto w-fit rounded-3xl border border-line bg-white p-3'>
							<QrImage value={qrRow.qrValue ?? qrRow.code} size={170} />
						</div>
						<p className='mt-4 font-mono text-2xl font-black text-ink'>
							{qrRow.code}
						</p>
						<p className='mt-2 text-[12.5px] text-ink-2'>
							Kodni joyida ko‘rsating. Internetsiz ham ishlaydi.
						</p>
					</Card>
					<Card className='mt-3'>
						<KeyValueList>
							<KeyValue label='Bron' value={qrRow.subtitle} />
							<KeyValue label='Vaqt' value={qrRow.whenLabel} />
							{qrRow.amountLabel && (
								<KeyValue label='Summa' value={qrRow.amountLabel} />
							)}
						</KeyValueList>
					</Card>
					{/* A queue ticket or a table booking has no detail route of its
					    own, so this sheet is it — the share and cancel that used to
					    crowd the summary card belong here. */}
					<div className='mt-4 space-y-2'>
						{qrRow.href && (
							<Button
								variant='primary'
								block
								onClick={() => router.push(qrRow.href!)}
							>
								Batafsil
							</Button>
						)}
						<Button variant='outline' block onClick={() => share(qrRow)}>
							<Share2 className='size-4' /> Ulashish
						</Button>
						{qrRow.cancellable && (
							<Button
								variant='outline'
								danger
								block
								onClick={() => {
									setQrRow(null)
									setCancelRow(qrRow)
								}}
							>
								<X className='size-4' /> Bronni bekor qilish
							</Button>
						)}
					</div>
				</BottomSheet>
			)}

			{cancelRow && (
				<BottomSheet
					title='Bronni bekor qilish?'
					onClose={() => setCancelRow(null)}
				>
					<Card>
						<p className='text-[13px] leading-5 text-ink-2'>
							{cancelRow.code} bekor qilinadi va joy darhol bo‘shatiladi.
							{cancelRow.kind === 'parking' &&
								' To‘lov 1–3 ish kuni ichida kartaga qaytariladi.'}
							{cancelRow.kind === 'queue' &&
								' Talonni tiklab bo‘lmaydi — qaytadan navbat olishingiz kerak.'}
						</p>
					</Card>
					<div className='mt-4 grid grid-cols-2 gap-2'>
						<Button variant='outline' onClick={() => setCancelRow(null)}>
							Qoldirish
						</Button>
						<Button variant='primary' danger onClick={() => cancel(cancelRow)}>
							Bekor qilish
						</Button>
					</div>
				</BottomSheet>
			)}

			{serviceSheet && (
				<ServiceBookingSheet
					kind={serviceSheet.kind}
					refId={serviceSheet.refId}
					onClose={() => setServiceSheet(null)}
					onNotify={toast.show}
				/>
			)}

			{/* Mounted only while open, so an abandoned choice never carries
			    over into the next attempt. */}
			{tableFlowOpen && (
				<TableBookingFlow
					onClose={() => setTableFlowOpen(false)}
					onNotify={toast.show}
				/>
			)}

			<ParkingBookingSheet
				parkingId={parkingSheet}
				onClose={() => setParkingSheet(null)}
				onNotify={toast.show}
			/>

			<Toast open={toast.open} message={toast.payload ?? ''} />
		</div>
	)
}
