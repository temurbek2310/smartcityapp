'use client'

import { getQueueDesk } from '@/data/queue-orgs'
import { cn } from '@/lib/cn'
import { formatDayMonth } from '@/lib/format'
import { deskNoun } from '@/lib/lexicon'
import {
	DESK_STATES,
	type DeskAvailabilityInput,
	type DeskSlot,
	type DeskState,
	isDeskSelectable,
} from '@/lib/queue-desks'
import { bookingDays } from '@/lib/service-slots'
import { tashkentDayKey } from '@/lib/tashkent-time'
import type { QueueOrg, QueueTicket } from '@/lib/types'

// The desk a ticket is served at, by name. A ticket without a chosen desk —
// legacy, or assigned by the organisation — keeps its window number.
// A ticket taken «Hozir» has none until it is called (windowNumber 0).
export function ticketDeskLabel(org: QueueOrg | undefined, ticket: QueueTicket) {
	const desk = org ? getQueueDesk(org, ticket.deskId) : undefined
	if (desk) return desk.label
	return ticket.windowNumber > 0
		? `${ticket.windowNumber}-oyna`
		: 'Navbat kelganda tayinlanadi'
}

// What to call that desk. Read off the organisation as well as the kind, so a
// café's counter is a «Kassa» and a clinic's room a «Xona» — never a «Joy»,
// which belongs to a parking space and a place to sit.
export function ticketDeskNoun(org: QueueOrg | undefined, ticket: QueueTicket) {
	const desk = org ? getQueueDesk(org, ticket.deskId) : undefined
	return deskNoun(org?.category, desk?.kind ?? 'window')
}

// «Bugun» / «Ertaga» / «3-okt». Before the clock is known — the server's
// render and the first paint — the date alone, so both agree.
export function scheduledDayLabel(at: string, now: number | null) {
	if (now === null) return formatDayMonth(at)
	const key = tashkentDayKey(at)
	return bookingDays(now, 2).find(day => day.key === key)?.label ?? formatDayMonth(at)
}

// The queue's «Схема мест»: every window, desk or specialist serving one
// line, with the same swatches the parking floor plan uses for free, taken and
// the customer's own.
export function DeskGrid({
	slots,
	mode,
	selectedDesk,
	onSelect,
}: {
	slots: readonly DeskSlot[]
	mode: DeskAvailabilityInput['mode']
	selectedDesk?: string | null
	onSelect?: (deskId: string, state: DeskState) => void
}) {
	const legend: DeskState[] = ['free', mode === 'live' ? 'busy' : 'booked', 'mine']

	return (
		<div>
			<div className='grid grid-cols-3 gap-[5px]'>
				{slots.map(({ desk, state }) => {
					const selected = desk.id === selectedDesk
					const pickable = isDeskSelectable(state)
					const tone = DESK_STATES[state]

					return (
						<button
							key={desk.id}
							type='button'
							aria-label={`${desk.label} · ${tone.label}`}
							disabled={!pickable && !selected}
							aria-pressed={selected}
							onClick={() => onSelect?.(desk.id, state)}
							className={cn(
								'flex min-h-[58px] flex-col items-center justify-center rounded-xl border-[1.5px] px-1.5 py-2 text-center transition-colors',
								selected
									? 'border-brand bg-brand text-white'
									: cn(tone.swatch, tone.text),
								!pickable && !selected && 'cursor-not-allowed',
							)}
						>
							<span className='font-mono text-[15px] font-black leading-none'>
								{desk.number}
							</span>
							<span className='mt-1 w-full truncate text-[10px] font-semibold'>
								{desk.kind === 'specialist' ? desk.label : (desk.role ?? desk.label)}
							</span>
						</button>
					)
				})}
			</div>

			<div className='mt-3 flex flex-wrap gap-x-3 gap-y-1.5'>
				{legend.map(state => (
					<span
						key={state}
						className='flex items-center gap-1.5 text-[11px] text-ink-2'
					>
						<i
							className={cn(
								'size-[11px] rounded-[3px] border-[1.5px]',
								DESK_STATES[state].swatch,
							)}
						/>
						{DESK_STATES[state].label}
					</span>
				))}
			</div>
		</div>
	)
}
