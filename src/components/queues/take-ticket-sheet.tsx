'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { BottomSheet } from '@/components/ui/bottom-sheet'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { KeyValue, KeyValueList } from '@/components/ui/key-value'
import { Switch } from '@/components/ui/switch'
import { useApp } from '@/context/app-context'
import { queueTicketHref } from '@/lib/bookings'
import type { QueueOrg, QueueService } from '@/lib/types'

// Two steps, the way City Goo splits them: pick the service (the number and
// the window both depend on it), then confirm with the numbers you are
// actually agreeing to.

function ticketNumberFor(service: QueueService, position: number) {
	return `${service.prefix}-${String(position + 11).padStart(2, '0')}`
}

// Position is derived from the average wait rather than stored: three
// minutes per person is City Goo's implied rate, and it keeps the number
// consistent with the wait shown on the same card.
function positionFor(service: QueueService) {
	return Math.max(1, Math.round(service.avgWaitMinutes / 3))
}

// When to set off, accounting for how far away the place is. Walking pace of
// roughly 80 m/min is what City Goo assumes; never less than five minutes,
// because "leave now" is not advice.
function leaveInMinutes(service: QueueService, distanceKm: number) {
	return Math.max(5, service.avgWaitMinutes - Math.round((distanceKm * 1000) / 80))
}

export function TakeTicketSheet({
	org,
	onClose,
}: {
	org: QueueOrg
	onClose: () => void
}) {
	const router = useRouter()
	const { takeQueueTicket } = useApp()
	const [service, setService] = useState<QueueService | null>(null)
	const [notify, setNotify] = useState(true)

	if (!service) {
		return (
			<BottomSheet title='Navbat olish' onClose={onClose}>
				<Card>
					<p className='text-[14px] font-bold text-ink'>{org.title}</p>
					<p className='mt-1 text-[12px] text-ink-3'>
						Xizmatni tanlang — raqam va oyna shunga bog‘liq.
					</p>
				</Card>

				<div className='mt-3 space-y-2'>
					{org.services.map(item => (
						<button
							key={item.id}
							type='button'
							onClick={() => setService(item)}
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
									{item.windows} oyna · taxminan {item.avgWaitMinutes} daqiqa
								</span>
							</span>
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
						</button>
					))}
				</div>
			</BottomSheet>
		)
	}

	const position = positionFor(service)
	const number = ticketNumberFor(service, position)

	return (
		<BottomSheet title='Navbatni tasdiqlash' onClose={onClose}>
			<Card className='text-center'>
				<p className='text-[11.5px] font-bold uppercase tracking-[.18em] text-ink-3'>
					Sizning raqamingiz
				</p>
				<p className='mt-2 font-mono text-4xl font-black text-brand'>{number}</p>
				<p className='mt-2 text-[12.5px] text-ink-2'>
					{org.title} · {service.title}
				</p>
			</Card>

			<Card className='mt-3'>
				<KeyValueList>
					<KeyValue label='Oldingizda' value={`${position} kishi`} />
					<KeyValue
						label='Kutish'
						value={`taxminan ${service.avgWaitMinutes} daqiqa`}
					/>
					<KeyValue label='Oyna' value={`${service.windows}-oyna`} />
					<KeyValue
						label='Chiqish tavsiya etiladi'
						value={`${leaveInMinutes(service, org.distanceKm)} daqiqadan keyin`}
					/>
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
						checked={notify}
						onChange={setNotify}
					/>
				</div>
			</Card>

			<Button
				variant='primary'
				block
				className='mt-4'
				onClick={() => {
					const ticket = takeQueueTicket({
						orgId: org.id,
						serviceId: service.id,
						number,
						position,
						etaMinutes: service.avgWaitMinutes,
						windowNumber: service.windows,
						notify,
					})
					// The ticket's own page is the confirmation, the same
					// way parking lands on its reservation.
					onClose()
					router.push(queueTicketHref(ticket.id))
				}}
			>
				Navbat olish
			</Button>
			<p className='mt-2 text-center text-[11px] text-ink-3'>
				Raqam chaqirilgandan keyin 5 daqiqa saqlanadi
			</p>
		</BottomSheet>
	)
}
