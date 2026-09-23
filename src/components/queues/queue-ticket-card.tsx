'use client'

import { Check, QrCode, RefreshCw, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Meter } from '@/components/ui/meter'
import { useApp } from '@/context/app-context'
import { queueTicketHref } from '@/lib/bookings'
import { cn } from '@/lib/cn'
import type { QueueOrg, QueueTicket } from '@/lib/types'

// The live ticket, or the button that creates one. City Goo gives this the
// top of the screen because it is the only thing on the page that is about
// *you* rather than about the organisation.
export function QueueTicketCard({
	org,
	ticket,
	onTake,
	onNotify,
}: {
	org: QueueOrg
	ticket: QueueTicket | undefined
	onTake: () => void
	onNotify: (message: string) => void
}) {
	const { advanceQueueTicket, arriveQueueTicket, cancelQueueTicket } = useApp()
	const router = useRouter()
	const [sheet, setSheet] = useState<'cancel' | null>(null)

	if (!ticket) {
		return (
			<Card>
				<div className='flex items-center justify-between gap-3'>
					<p className='text-[15px] font-extrabold text-ink'>
						Elektron navbat
					</p>
					<Badge tone='gray'>{org.windows} ta oyna ishlamoqda</Badge>
				</div>
				<p className='mt-2 text-[12.5px] leading-5 text-ink-2'>
					Navbatni oldindan oling — kelguningizcha o‘rningiz saqlanadi va
					qachon chiqish kerakligini aytamiz.
				</p>
				<Button variant='primary' block className='mt-4' onClick={onTake}>
					Navbat olish
				</Button>
			</Card>
		)
	}

	const called = ticket.status === 'called'
	// «Men keldim» pressed: at the window, waiting to be served. Still live.
	const arrived = ticket.status === 'arrived'
	const atWindow = called || arrived
	// How far through the queue: 0 people left reads as complete.
	const progress = ticket.initialPosition
		? ((ticket.initialPosition - ticket.position) / ticket.initialPosition) * 100
		: 100
	const service = org.services.find(item => item.id === ticket.serviceId)

	return (
		<>
			<Card className={cn('border-[1.5px]', atWindow ? 'border-ok' : 'border-brand')}>
				<div className='flex items-center justify-between gap-3'>
					<Badge tone={atWindow ? 'ok' : 'brand'}>
						{arrived
							? 'Keldingiz'
							: called
								? 'Sizni chaqirishmoqda'
								: 'Siz navbatdasiz'}
					</Badge>
					<span className='truncate text-[11.5px] text-ink-3'>
						{service?.title}
					</span>
				</div>

				<div className='mt-3 flex items-center gap-3'>
					<div
						className={cn(
							'w-24 shrink-0 rounded-2xl px-2 py-3 text-center',
							atWindow ? 'bg-ok-bg' : 'bg-brand-50',
						)}
					>
						<p
							className={cn(
								'font-mono text-2xl font-black',
								atWindow ? 'text-ok' : 'text-brand',
							)}
						>
							{ticket.number}
						</p>
					</div>

					<div className='min-w-0 flex-1'>
						{arrived ? (
							<>
								<p className='text-[15px] font-extrabold text-ink'>
									{ticket.windowNumber}-oynada xizmat kutilmoqda
								</p>
								<p className='mt-1 text-[11.5px] leading-4 text-ink-3'>
									Kelganingiz qayd etildi. Xizmat tugagach talon tarixga
									o‘tadi.
								</p>
							</>
						) : called ? (
							<>
								<p className='text-[15px] font-extrabold text-ink'>
									{ticket.windowNumber}-oynaga o‘ting
								</p>
								<p className='mt-1 text-[11.5px] leading-4 text-ink-3'>
									Raqam chaqirilgandan keyin 5 daqiqa saqlanadi. Kechiksangiz
									navbatga qayta turishingiz mumkin.
								</p>
							</>
						) : (
							<>
								<p className='text-[15px] font-extrabold text-ink'>
									Oldingizda {ticket.position} kishi
								</p>
								<p className='mt-1 text-[11.5px] text-ink-3'>
									Taxminan {ticket.etaMinutes} daqiqadan keyin
								</p>
								<Meter
									value={progress}
									tone='bg-brand'
									height={5}
									className='mt-2'
								/>
							</>
						)}
					</div>
				</div>

				<div className='mt-3 grid grid-cols-3 gap-2'>
					<Button
						size='sm'
						variant='outline'
						// Demo stand-in for the live feed. While called it waits on
						// the customer; once they have checked in, the next move is
						// the window finishing their service.
						disabled={called}
						onClick={() => {
							advanceQueueTicket(ticket.id)
							if (arrived) onNotify('Xizmat ko‘rsatildi')
						}}
					>
						<RefreshCw className='size-3.5' /> Yangilash
					</Button>
					{/* The ticket's own page draws its QR, number, position and
					    window — this card used to keep a second copy in a sheet. */}
					<Button
						size='sm'
						variant='outline'
						onClick={() => router.push(queueTicketHref(ticket.id))}
					>
						<QrCode className='size-3.5' /> Talon
					</Button>
					<Button
						size='sm'
						variant='outline'
						danger
						onClick={() => setSheet('cancel')}
					>
						<X className='size-3.5' /> Bekor
					</Button>
				</div>

				{called && (
					<Button
						variant='primary'
						block
						className='mt-2'
						onClick={() => {
							arriveQueueTicket(ticket.id)
							onNotify('Kelganingiz qayd etildi')
						}}
					>
						<Check className='size-4' /> Men keldim
					</Button>
				)}
			</Card>

			{sheet === 'cancel' && (
				<BottomSheet title='Navbatni bekor qilish?' onClose={() => setSheet(null)}>
					<Card>
						<p className='text-[13px] leading-5 text-ink-2'>
							Talon bekor qilinadi va uni tiklab bo‘lmaydi. Qaytadan navbat
							olsangiz, oxiridan boshlaysiz.
						</p>
					</Card>
					<div className='mt-4 grid grid-cols-2 gap-2'>
						<Button variant='outline' onClick={() => setSheet(null)}>
							Qoldirish
						</Button>
						<Button
							variant='primary'
							danger
							onClick={() => {
								cancelQueueTicket(ticket.id)
								setSheet(null)
								onNotify('Navbat bekor qilindi')
							}}
						>
							Bekor qilish
						</Button>
					</div>
				</BottomSheet>
			)}
		</>
	)
}
