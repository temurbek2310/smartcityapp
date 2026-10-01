'use client'

import { CalendarClock } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { type ReactNode, useMemo, useRef, useState } from 'react'

import { DeskGrid } from '@/components/queues/desk-grid'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Chip } from '@/components/ui/chip'
import { HorizontalRail } from '@/components/ui/horizontal-rail'
import { KeyValue, KeyValueList } from '@/components/ui/key-value'
import { Switch } from '@/components/ui/switch'
import { useApp } from '@/context/app-context'
import { desksForService, getQueueService } from '@/data/queue-orgs'
import { deskNoun, queueActionLabel } from '@/lib/lexicon'
import {
	QUEUE_CONFLICT_MESSAGE,
	QUEUE_DESK_CONFLICT_MESSAGE,
	findLiveQueueTicket,
} from '@/lib/booking-conflicts'
import {
	QUEUE_CHECKIN_LEAD_MINUTES,
	QUEUE_NO_SHOW_MINUTES,
} from '@/lib/booking-lifecycle'
import { queueTicketHref } from '@/lib/bookings'
import {
	type DeskAvailabilityInput,
	type DeskSlot,
	deskAvailability,
	firstFreeDesk,
	freeDeskCount,
	isDeskSelectable,
} from '@/lib/queue-desks'
import {
	QUEUE_NOW_SLOT,
	bookingDays,
	daySlots,
	defaultQueueSelection,
	queueSlotTimes,
	serviceWhenLabel,
	slotInstant,
} from '@/lib/service-slots'
import type { QueueOrg, QueueService, QueueTicket } from '@/lib/types'

// Four steps, the way parking splits a booking: the service (the number, the
// slots and the desks all depend on it), when — «Hozir» or a later slot —,
// which window, desk or specialist, then confirm with the numbers you are
// actually agreeing to.

export type QueueTicketDraft = {
	orgId: string
	serviceId: string | null
	// A Tashkent calendar day key, one of bookingDays(now).
	dayKey: string
	// QUEUE_NOW_SLOT, a Tashkent HH:mm on dayKey, or null when nothing is left.
	slot: string | null
	deskId: string | null
	notify: boolean
	// When the sheet opened. The rail, the grid and the desk board are read
	// against it so they hold still while the sheet is open; confirm re-reads
	// the clock.
	now: number
}

type Step = 'service' | 'when' | 'desk' | 'confirm'

// The first start on a day that still has a desk free, so a choice of service
// or date never lands on a time the next step cannot use.
function firstOpenTime(
	org: QueueOrg,
	item: QueueService,
	dayKey: string,
	now: number,
	tickets: readonly QueueTicket[],
) {
	return (
		daySlots(dayKey, now, queueSlotTimes(org, item)).find(
			slot =>
				!slot.past &&
				freeDeskCount(
					deskAvailability({
						org,
						serviceId: item.id,
						at: new Date(slot.iso),
						mode: 'scheduled',
						tickets,
					}),
				) > 0,
		)?.time ?? null
	)
}

// When a line should default to: «Hozir» while its doors are open, otherwise
// the earliest start it can still be booked for.
function defaultWhen(
	org: QueueOrg,
	item: QueueService,
	now: number,
	tickets: readonly QueueTicket[],
) {
	const openForNow = deskAvailability({
		org,
		serviceId: item.id,
		at: now,
		mode: 'live',
		tickets,
	}).some(slot => slot.state !== 'closed')
	if (openForNow) return { dayKey: bookingDays(now)[0].key, slot: QUEUE_NOW_SLOT }
	if (!item.bookable) return { dayKey: bookingDays(now)[0].key, slot: null }
	const preferred = defaultQueueSelection(org, item, now)
	return {
		dayKey: preferred.dayKey,
		slot: firstOpenTime(org, item, preferred.dayKey, now, tickets) ?? preferred.time,
	}
}

// The service the sheet opens on: the one the caller named — Home's «Olib
// ketish» names the takeaway counter — or the venue's only line, which there
// is nothing to choose between. Otherwise the customer picks.
function openingService(org: QueueOrg, serviceId: string | undefined) {
	const named = serviceId ? getQueueService(org, serviceId) : undefined
	return named ?? (org.services.length === 1 ? org.services[0] : undefined)
}

function makeDraft(
	org: QueueOrg,
	serviceId: string | undefined,
	tickets: readonly QueueTicket[],
): QueueTicketDraft {
	const now = Date.now()
	const base = { orgId: org.id, deskId: null, notify: true, now }
	const service = openingService(org, serviceId)
	if (!service) {
		return { ...base, serviceId: null, dayKey: bookingDays(now)[0].key, slot: null }
	}
	return { ...base, serviceId: service.id, ...defaultWhen(org, service, now, tickets) }
}

function ticketNumberFor(service: QueueService, position: number) {
	return `${service.prefix}-${String(position + 11).padStart(2, '0')}`
}

// Position is derived from the average wait rather than stored: three
// minutes per person is City Goo's implied rate, and it keeps the number
// consistent with the wait shown on the same card. A booked ticket gets a
// fresh estimate when it joins the line.
function positionFor(service: QueueService) {
	return Math.max(1, Math.round(service.avgWaitMinutes / 3))
}

// When to set off, accounting for how far away the place is. Walking pace of
// roughly 80 m/min is what City Goo assumes; never less than five minutes,
// because "leave now" is not advice.
function leaveInMinutes(service: QueueService, distanceKm: number) {
	return Math.max(5, service.avgWaitMinutes - Math.round((distanceKm * 1000) / 80))
}

type SlotOption = {
	time: string
	past: boolean
	free: number
	total: number
}

export function TakeTicketSheet({
	org,
	serviceId,
	onClose,
}: {
	org: QueueOrg
	// The line to open on, when the caller already knows it.
	serviceId?: string
	onClose: () => void
}) {
	const router = useRouter()
	const { takeQueueTicket, queueTickets } = useApp()
	const [draft, setDraft] = useState<QueueTicketDraft>(() =>
		makeDraft(org, serviceId, queueTickets),
	)
	const [step, setStep] = useState<Step>(() =>
		openingService(org, serviceId) ? 'when' : 'service',
	)
	const [error, setError] = useState<string | null>(null)
	// A double tap on the confirm button runs both handlers before the sheet
	// unmounts; only a ref is already set when the second one runs.
	const submittingRef = useRef(false)

	const service = draft.serviceId ? getQueueService(org, draft.serviceId) : undefined
	const live = draft.slot === QUEUE_NOW_SLOT

	// Home's place sheet and /queues both open this sheet, and the store's
	// takeQueueTicket() refuses a second live ticket for the same line
	// whichever screen asks. These reads only say so up front.
	const liveFor = (serviceId: string) =>
		findLiveQueueTicket(queueTickets, { orgId: org.id, serviceId })

	const days = useMemo(() => bookingDays(draft.now), [draft.now])
	const todayKey = days[0].key

	function boardAt(
		serviceId: string,
		at: number | Date,
		mode: DeskAvailabilityInput['mode'],
		tickets: readonly QueueTicket[] = queueTickets,
	) {
		return deskAvailability({ org, serviceId, at, mode, tickets })
	}

	// «Hozir» and every bookable start on the chosen day, each with how many
	// of the line's desks are still free then.
	const nowBoard = useMemo(
		() =>
			service
				? deskAvailability({ org, serviceId: service.id, at: draft.now, mode: 'live', tickets: queueTickets })
				: [],
		[org, service, draft.now, queueTickets],
	)
	const slotOptions = useMemo<SlotOption[]>(() => {
		if (!service) return []
		const times = queueSlotTimes(org, service)
		return daySlots(draft.dayKey, draft.now, times).map(slot => {
			const board = deskAvailability({
				org,
				serviceId: service.id,
				at: slot.iso,
				mode: 'scheduled',
				tickets: queueTickets,
			})
			return {
				time: slot.time,
				past: slot.past,
				free: freeDeskCount(board),
				total: board.length,
			}
		})
	}, [org, service, draft.dayKey, draft.now, queueTickets])

	const nowFree = freeDeskCount(nowBoard)
	// «Hozir» joins the line whenever the doors are open, busy desks or not:
	// the organisation assigns the desk when the number comes up.
	const openNow = nowBoard.some(slot => slot.state !== 'closed')
	const canTakeNow = draft.dayKey === todayKey && openNow

	// The board for the slot in hand: live at the moment the sheet opened, or
	// the booked slot's own start.
	const deskSlots: DeskSlot[] = useMemo(() => {
		if (!service || !draft.slot) return []
		if (draft.slot === QUEUE_NOW_SLOT) return nowBoard
		return deskAvailability({
			org,
			serviceId: service.id,
			at: slotInstant(draft.dayKey, draft.slot),
			mode: 'scheduled',
			tickets: queueTickets,
		})
	}, [org, service, draft.slot, draft.dayKey, nowBoard, queueTickets])

	// The desk the ticket will actually use. Derived rather than stored, so a
	// change of slot that takes the chosen desk away falls back to the first
	// free one instead of carrying a desk the confirm would refuse.
	const chosen = deskSlots.find(slot => slot.desk.id === draft.deskId)
	const selectedDeskId =
		chosen && isDeskSelectable(chosen.state) ? chosen.desk.id : firstFreeDesk(deskSlots)
	const selectedDesk = deskSlots.find(slot => slot.desk.id === selectedDeskId)?.desk
	// What this organisation calls a desk, and what joining its line is called.
	const noun = deskNoun(org.category, deskSlots[0]?.desk.kind)
	const serviceNoun = (item: QueueService) =>
		deskNoun(org.category, desksForService(org, item.id)[0]?.kind)
	// Before a line is chosen there is no board to read a kind off, so the
	// organisation's own first desk stands in.
	const orgNoun = deskNoun(org.category, org.desks[0]?.kind)
	const takeLabel = queueActionLabel(org.category)

	function update(patch: Partial<QueueTicketDraft>) {
		setError(null)
		setDraft(current => ({ ...current, ...patch }))
	}

	function openTicket(ticketId: string) {
		onClose()
		router.push(queueTicketHref(ticketId))
	}

	function chooseService(item: QueueService) {
		update({
			serviceId: item.id,
			...defaultWhen(org, item, draft.now, queueTickets),
			deskId: null,
		})
		setStep('when')
	}

	function chooseDay(dayKey: string) {
		if (!service) return
		// A time already chosen survives a change of date whenever that date
		// still has it free; otherwise the earliest one left.
		const kept =
			draft.slot && draft.slot !== QUEUE_NOW_SLOT
				? daySlots(dayKey, draft.now, queueSlotTimes(org, service)).find(
						slot =>
							slot.time === draft.slot &&
							!slot.past &&
							freeDeskCount(boardAt(service.id, new Date(slot.iso), 'scheduled')) > 0,
					)?.time
				: undefined
		const slot =
			dayKey === todayKey && openNow
				? QUEUE_NOW_SLOT
				: (kept ??
					firstOpenTime(org, service, dayKey, draft.now, queueTickets))
		update({ dayKey, slot, deskId: null })
	}

	function go(next: Step) {
		setError(null)
		setStep(next)
	}

	function confirm() {
		if (!service || !draft.slot || (!live && !selectedDesk)) return
		if (submittingRef.current) return

		// Against the real clock, not the one the sheet opened with: a fixed
		// slot can go by while the sheet is open, and «Hozir» keeps moving.
		const currentTime = Date.now()
		let scheduledAt: string | undefined
		if (draft.slot === QUEUE_NOW_SLOT) {
			const board = boardAt(service.id, currentTime, 'live')
			if (board.every(slot => slot.state === 'closed')) {
				setError('Tashkilot hozir yopiq. Boshqa vaqtni tanlang.')
				setStep('when')
				return
			}
		} else {
			const start = slotInstant(draft.dayKey, draft.slot)
			if (start.getTime() <= currentTime) {
				setError('Tanlangan vaqt o‘tib ketgan. Boshqa vaqtni tanlang.')
				setStep('when')
				return
			}
			scheduledAt = start.toISOString()
		}

		submittingRef.current = true
		const position = positionFor(service)
		const attempt = takeQueueTicket({
			orgId: org.id,
			serviceId: service.id,
			number: ticketNumberFor(service, position),
			position,
			etaMinutes: service.avgWaitMinutes,
			// A live ticket's desk is assigned when it is called.
			windowNumber: live ? 0 : (selectedDesk?.number ?? 0),
			notify: draft.notify,
			scheduledAt,
			deskId: live ? undefined : selectedDesk?.id,
		})
		if (!attempt.ok) {
			submittingRef.current = false
			if (attempt.reason === 'past') {
				setError('Tanlangan vaqt o‘tib ketgan. Boshqa vaqtni tanlang.')
				setStep('when')
			} else if (attempt.existing.serviceId !== service.id) {
				// The same desk, held through another line at this time.
				setError(QUEUE_DESK_CONFLICT_MESSAGE)
				setStep('desk')
			}
			// Otherwise taken from another screen since this render: the
			// notice below takes over on the next render.
			return
		}
		// The ticket's own page is the confirmation, the same way parking
		// lands on its reservation.
		openTicket(attempt.created.id)
	}

	const errorCard = error && (
		<div className='mb-3 flex items-start gap-2.5 rounded-2xl bg-warn-bg p-3.5'>
			<CalendarClock className='mt-0.5 size-4 shrink-0 text-warn' />
			<p className='text-[12.5px] font-semibold leading-5 text-ink'>{error}</p>
		</div>
	)

	const footer = (back: Step, next: ReactNode) => (
		<div className='mt-4 grid grid-cols-[auto_1fr] gap-2'>
			<Button variant='outline' onClick={() => go(back)}>
				Orqaga
			</Button>
			{next}
		</div>
	)

	if (step === 'service' || !service) {
		return (
			<BottomSheet title={takeLabel} onClose={onClose}>
				<Card>
					<p className='text-[14px] font-bold text-ink'>{org.title}</p>
					<p className='mt-1 text-[12px] text-ink-3'>
						Xizmatni tanlang — vaqt ham, {orgNoun.toLowerCase()} ham shunga
						bog‘liq.
					</p>
				</Card>

				<div className='mt-3 space-y-2'>
					{org.services.map(item => (
						<button
							key={item.id}
							type='button'
							onClick={() => chooseService(item)}
							className='flex w-full items-center gap-3 rounded-card-lg bg-card p-3 text-left shadow-card'
						>
							<span className='grid size-10 shrink-0 place-items-center rounded-xl bg-brand-50 font-mono text-[15px] font-black text-brand'>
								{item.prefix}
							</span>
							<span className='min-w-0 flex-1'>
								<span className='block truncate text-[14px] font-semibold text-ink'>
									{item.title}
								</span>
								<span className='mt-0.5 block text-[11px] text-ink-3'>
									{item.windows} {serviceNoun(item).toLowerCase()} · taxminan{' '}
									{item.avgWaitMinutes} daqiqa
									{item.bookable ? ' · oldindan' : ''}
								</span>
							</span>
							{liveFor(item.id) ? (
								<Badge tone='ok'>Faol talon</Badge>
							) : (
								<Badge
									tone={
										item.avgWaitMinutes < 15
											? 'ok'
											: item.avgWaitMinutes < 35
												? 'warn'
												: 'bad'
									}
								>
									{item.avgWaitMinutes} daq
								</Badge>
							)}
						</button>
					))}
				</div>
			</BottomSheet>
		)
	}

	const existing = liveFor(service.id)

	if (existing) {
		return (
			<BottomSheet title={takeLabel} onClose={onClose}>
				<Card className='text-center'>
					<p className='text-[13px] font-bold text-ink'>
						{QUEUE_CONFLICT_MESSAGE}
					</p>
					<p className='mt-2 font-mono text-3xl font-black text-brand'>
						{existing.number}
					</p>
					<p className='mt-2 text-[12.5px] text-ink-2'>
						{org.title} · {service.title}
					</p>
				</Card>
				<Button
					variant='primary'
					block
					className='mt-4'
					onClick={() => openTicket(existing.id)}
				>
					Talonni ko‘rish
				</Button>
				<Button block className='mt-2' onClick={() => go('service')}>
					Boshqa xizmat
				</Button>
			</BottomSheet>
		)
	}

	const whenLabel = live
		? 'Hozir'
		: draft.slot
			? serviceWhenLabel(slotInstant(draft.dayKey, draft.slot), draft.now)
			: '—'

	if (step === 'when') {
		const showNow = draft.dayKey === todayKey
		return (
			<BottomSheet title='Vaqtni tanlang' onClose={onClose}>
				{errorCard}
				<Card>
					<div className='flex items-center gap-3'>
						<span className='grid size-10 shrink-0 place-items-center rounded-xl bg-brand-50 font-mono text-[15px] font-black text-brand'>
							{service.prefix}
						</span>
						<div className='min-w-0'>
							<p className='truncate text-[14px] font-bold text-ink'>
								{service.title}
							</p>
							<p className='mt-0.5 truncate text-[11.5px] text-ink-3'>
								{org.title} · {org.openTime}–{org.closeTime}
							</p>
						</div>
					</div>
				</Card>

				{service.bookable && (
					<Card className='mt-3 p-4'>
						<p className='text-sm font-black text-ink'>Sana</p>
						<HorizontalRail className='mt-3 gap-2'>
							{days.map(day => (
								<Chip
									key={day.key}
									active={draft.dayKey === day.key}
									onClick={() => chooseDay(day.key)}
									className='h-11 px-4'
								>
									{day.label}
								</Chip>
							))}
						</HorizontalRail>
					</Card>
				)}

				<Card className='mt-3 p-4'>
					<p className='text-sm font-black text-ink'>Vaqt</p>
					<div className='mt-3 grid grid-cols-4 gap-2'>
						{showNow && (
							<SlotChip
								label={QUEUE_NOW_SLOT}
								free={nowFree}
								total={nowBoard.length}
								active={live}
								disabled={!canTakeNow}
								onClick={() => update({ slot: QUEUE_NOW_SLOT, deskId: null })}
							/>
						)}
						{slotOptions.map(option => (
							<SlotChip
								key={option.time}
								label={option.time}
								free={option.free}
								total={option.total}
								active={draft.slot === option.time}
								// A time that has gone by stays on screen rather than
								// vanishing, so the grid keeps its shape.
								disabled={option.past || option.free === 0}
								onClick={() => update({ slot: option.time, deskId: null })}
							/>
						))}
					</div>
					{!draft.slot && (
						<p className='mt-3 text-[11.5px] text-ink-3'>
							{service.bookable
								? 'Bu kunda bo‘sh vaqt qolmadi. Boshqa kunni tanlang.'
								: `Hozir yopiq. Ish vaqti: ${org.openTime}–${org.closeTime}.`}
						</p>
					)}
				</Card>

				{footer(
					'service',
					<Button
						variant='primary'
						disabled={!draft.slot || (!live && !selectedDeskId)}
						onClick={() => go(live ? 'confirm' : 'desk')}
					>
						Davom etish
					</Button>,
				)}
			</BottomSheet>
		)
	}

	if (step === 'desk') {
		return (
			<BottomSheet title={`${noun}ni tanlang`} onClose={onClose}>
				{errorCard}
				<Card className='p-4'>
					<div className='flex items-baseline justify-between gap-3'>
						<p className='truncate text-[14px] font-bold text-ink'>
							{service.title}
						</p>
						<p className='shrink-0 text-[12px] font-semibold text-ink-3'>
							{whenLabel}
						</p>
					</div>
					<div className='mt-3'>
						<DeskGrid
							slots={deskSlots}
							mode={live ? 'live' : 'scheduled'}
							selectedDesk={selectedDeskId}
							onSelect={(deskId, state) => {
								if (!isDeskSelectable(state)) return
								update({ deskId })
							}}
						/>
					</div>
					{selectedDesk && (
						<div className='mt-4 flex items-center justify-between gap-3 border-t border-line pt-3'>
							<span className='text-[12px] text-ink-3'>{noun}</span>
							<span className='truncate text-[13px] font-bold text-ink'>
								{selectedDesk.label}
								{selectedDesk.role ? ` · ${selectedDesk.role}` : ''}
							</span>
						</div>
					)}
				</Card>

				{footer(
					'when',
					<Button
						variant='primary'
						disabled={!selectedDesk}
						onClick={() => {
							update({ deskId: selectedDeskId })
							setStep('confirm')
						}}
					>
						{selectedDesk ? 'Davom etish' : `Bo‘sh ${noun.toLowerCase()} yo‘q`}
					</Button>,
				)}
			</BottomSheet>
		)
	}

	const position = positionFor(service)
	const number = ticketNumberFor(service, position)

	return (
		<BottomSheet title='Talonni tasdiqlash' onClose={onClose}>
			{errorCard}
			<Card className='text-center'>
				<p className='text-[11.5px] font-bold uppercase tracking-[.18em] text-ink-3'>
					Sizning taloningiz
				</p>
				<p className='mt-2 font-mono text-4xl font-black text-brand'>{number}</p>
				<p className='mt-2 text-[12.5px] text-ink-2'>
					{org.title} · {service.title}
				</p>
			</Card>

			<Card className='mt-3'>
				<KeyValueList>
					<KeyValue label='Vaqt' value={whenLabel} />
					<KeyValue
						label={noun}
						value={
							live
								? 'Navbat kelganda tayinlanadi'
								: selectedDesk
									? `${selectedDesk.label}${selectedDesk.role ? ` · ${selectedDesk.role}` : ''}`
									: '—'
						}
					/>
					{live ? (
						<>
							<KeyValue label='Oldingizda' value={`${position} kishi`} />
							<KeyValue
								label='Kutish'
								value={`taxminan ${service.avgWaitMinutes} daqiqa`}
							/>
							<KeyValue
								label='Chiqish tavsiya etiladi'
								value={`${leaveInMinutes(service, org.distanceKm)} daqiqadan keyin`}
							/>
						</>
					) : (
						<KeyValue
							label='Navbatga qo‘shilish'
							value={`${QUEUE_CHECKIN_LEAD_MINUTES} daqiqa oldin`}
						/>
					)}
				</KeyValueList>
			</Card>

			<Card className='mt-3'>
				<div className='flex items-center justify-between gap-3'>
					<div className='min-w-0'>
						<p className='text-[14px] font-semibold text-ink'>
							10 daqiqa oldin eslatish
						</p>
						<p className='mt-0.5 text-[11px] text-ink-3'>
							Navbatingiz yaqinlashganda xabar beramiz
						</p>
					</div>
					<Switch
						label='10 daqiqa oldin eslatish'
						checked={draft.notify}
						onChange={notify => update({ notify })}
					/>
				</div>
			</Card>

			{footer(
				live ? 'when' : 'desk',
				<Button variant='primary' onClick={confirm}>
					{live ? takeLabel : 'Band qilish'}
				</Button>,
			)}
			<p className='mt-2 text-center text-[11px] text-ink-3'>
				{live
					? 'Talon chaqirilgandan keyin 5 daqiqa saqlanadi'
					: `Kelmasangiz, ${QUEUE_NO_SHOW_MINUTES} daqiqadan keyin bekor qilinadi`}
			</p>
		</BottomSheet>
	)
}

// A time on the grid with how many of the line's desks are free then.
function SlotChip({
	label,
	free,
	total,
	active,
	disabled,
	onClick,
}: {
	label: string
	free: number
	total: number
	active: boolean
	disabled: boolean
	onClick: () => void
}) {
	return (
		<Chip
			active={active}
			disabled={disabled}
			onClick={onClick}
			aria-label={`${label} · ${free} / ${total} bo‘sh`}
			className='h-12 flex-col justify-center gap-0 px-1 disabled:cursor-not-allowed disabled:opacity-40'
		>
			<span className='text-[13px] font-bold leading-none'>{label}</span>
			<span
				className={`mt-1 text-[10px] font-semibold leading-none ${active ? 'text-white/80' : 'text-ink-3'}`}
			>
				{free}/{total}
			</span>
		</Chip>
	)
}
