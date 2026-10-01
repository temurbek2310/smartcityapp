'use client'

import {
	BellRing,
	CircleParking,
	Clock3,
	HelpCircle,
	Users,
} from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useMemo, useState } from 'react'

import {
	scheduledDayLabel,
	ticketDeskLabel,
} from '@/components/queues/desk-grid'
import { QueueForecastCard } from '@/components/queues/queue-forecast-card'
import { QueueOrgCard } from '@/components/queues/queue-org-card'
import { QueueTicketCard } from '@/components/queues/queue-ticket-card'
import { TakeTicketSheet } from '@/components/queues/take-ticket-sheet'
import { AppBar } from '@/components/ui/app-bar'
import { Badge } from '@/components/ui/badge'
import { BarChart } from '@/components/ui/bar-chart'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Chip } from '@/components/ui/chip'
import { HorizontalRail } from '@/components/ui/horizontal-rail'
import { IconButton } from '@/components/ui/icon-button'
import { IconTile } from '@/components/ui/icon-tile'
import { LoadingScreen } from '@/components/ui/loading-screen'
import { SearchField } from '@/components/ui/search-field'
import { SectionHeader } from '@/components/ui/section-header'
import { Toast } from '@/components/ui/toast'
import { useApp } from '@/context/app-context'
import { useDistanceFromUser } from '@/context/location-context'
import { getParking } from '@/data/parkings'
import { QUEUE_HOURS, QUEUE_ORGS, getQueueOrg } from '@/data/queue-orgs'
import { useClock } from '@/hooks/use-clock'
import { useDirections } from '@/hooks/use-directions'
import { useToast } from '@/hooks/use-toast'
import { occupancyTone } from '@/lib/availability'
import {
	QUEUE_CHECKIN_LEAD_MINUTES,
	isQueueTicketLive,
} from '@/lib/booking-lifecycle'
import { findLiveQueueTicket } from '@/lib/booking-conflicts'
import { cn } from '@/lib/cn'
import { formatDistance, formatTime } from '@/lib/format'
import type { QueueCategory, QueueTicket } from '@/lib/types'

const CATEGORIES: { id: QueueCategory | 'all'; label: string }[] = [
	{ id: 'all', label: 'Barchasi' },
	{ id: 'cafe', label: 'Kafe' },
	{ id: 'bank', label: 'Banklar' },
	{ id: 'clinic', label: 'Klinikalar' },
	{ id: 'gov', label: 'Davlat xizmatlari' },
	{ id: 'auto', label: 'Avtoservis' },
]

const HOW_IT_WORKS = [
	'Tashkilot va xizmatni tanlang — talon va oyna shunga bog‘liq.',
	'Talon olasiz, o‘rningiz shu zahoti band qilinadi.',
	'Navbat qanday siljiyotganini real vaqtda kuzatasiz.',
	'Navbatingizga 10 daqiqa qolganda xabar beramiz.',
	'Kelib talonni ko‘rsatasiz — talon 5 daqiqa saqlanadi.',
]

// What the banner says about the ticket in hand, by where it stands. A booked
// ticket is not in line yet — its slot and desk are the news, not an
// estimate it does not have.
function activeTicketNotice(ticket: QueueTicket, now: number | null) {
	const desk = ticketDeskLabel(getQueueOrg(ticket.orgId), ticket)
	switch (ticket.status) {
		case 'scheduled':
			return ticket.scheduledAt
				? `${scheduledDayLabel(ticket.scheduledAt, now)}, ${formatTime(ticket.scheduledAt)} · ${desk}. Navbat ${QUEUE_CHECKIN_LEAD_MINUTES} daqiqa oldin boshlanadi.`
				: `Oldindan band qilingan · ${desk}.`
		case 'called':
			return `Sizni chaqirishmoqda — ${desk}.`
		case 'arrived':
			return `Kelganingiz qayd etildi · ${desk}.`
		default:
			return ticket.etaMinutes > 0
				? `Taxminan ${ticket.etaMinutes} daqiqadan keyin chaqiramiz.`
				: 'Navbatingiz yetib keldi — tayyor turing.'
	}
}

export default function QueuesPage() {
	return (
		<Suspense fallback={<LoadingScreen />}>
			<QueuesView />
		</Suspense>
	)
}

function QueuesView() {
	const router = useRouter()
	const toast = useToast<string>()
	const directions = useDirections()
	const { queueTickets, notificationPrefs, setNotificationPref } = useApp()
	const fromUser = useDistanceFromUser()

	// /map's "Ochish" lands here on a specific organisation.
	const requestedOrg = useSearchParams().get('org')
	const [orgId, setOrgId] = useState(
		requestedOrg && getQueueOrg(requestedOrg) ? requestedOrg : QUEUE_ORGS[0].id,
	)
	const [category, setCategory] = useState<QueueCategory | 'all'>('all')
	const [query, setQuery] = useState('')
	const [takeOpen, setTakeOpen] = useState(false)
	const [switchOpen, setSwitchOpen] = useState(false)
	const [howOpen, setHowOpen] = useState(false)

	const org = getQueueOrg(orgId) ?? QUEUE_ORGS[0]

	// One live ticket at a time, the way City Goo models it. Closed tickets
	// stay in the array and become the history list below.
	const activeTicket = queueTickets.find(ticket =>
		isQueueTicketLive(ticket.status),
	)
	const history = queueTickets.filter(
		ticket => !isQueueTicketLive(ticket.status),
	)
	const now = useClock(30_000)

	const filtered = useMemo(() => {
		const needle = query.trim().toLowerCase()
		return QUEUE_ORGS.filter(item => {
			if (category !== 'all' && item.category !== category) return false
			if (
				needle &&
				!`${item.title} ${item.address}`.toLowerCase().includes(needle)
			)
				return false
			return true
		}).sort((a, b) => a.waitMinutes - b.waitMinutes)
	}, [category, query])

	// Same category first, then anywhere that is genuinely faster than here.
	const alternatives = useMemo(() => {
		const sameCategory = QUEUE_ORGS.filter(
			item => item.id !== org.id && item.category === org.category,
		)
		const faster = QUEUE_ORGS.filter(
			item =>
				item.id !== org.id &&
				item.category !== org.category &&
				item.waitMinutes < org.waitMinutes,
		)
		return [...sameCategory, ...faster].slice(0, 4)
	}, [org])

	const peakLoad = Math.max(...org.hourlyLoad)
	const openHours = org.hourlyLoad
		.map((load, index) => ({ load, label: QUEUE_HOURS[index] }))
		.filter(hour => hour.load > 0)
	const quietest = openHours.reduce(
		(best, hour) => (hour.load < best.load ? hour : best),
		openHours[0],
	)
	const parking = getParking(org.parkingId)

	// What the app would actually push, given the ticket in hand and this
	// organisation's load. City Goo hardcodes three of these; deriving them
	// means the section never announces a queue position nobody holds.
	const queueNotices = [
		...(activeTicket
			? [
					{
						icon: Users,
						tone: 'bg-ok-bg text-ok',
						title: `Sizning navbatingiz ${activeTicket.number}`,
						body: activeTicketNotice(activeTicket, now),
						time: formatTime(activeTicket.createdAt),
					},
				]
			: [{ icon: Users, tone: 'bg-ok-bg text-ok', title: 'Navbatni onlayn oling',
				body: `${org.title} uchun xizmat tanlang va talon oling.`, time: 'hozir' }]),
		...(org.open
			? [
					{
						icon: Clock3,
						tone: 'bg-warn-bg text-warn',
						title: 'Hozirgi kutish vaqti',
						body: `${org.title} — kutish ${org.waitMinutes} daqiqa.`,
						time: 'hozir',
					},
				]
			: []),
		...(parking
			? [
					{
						icon: CircleParking,
						tone: 'bg-brand-50 text-brand',
						title: 'Chiqish haqida eslatma',
						body: `${parking.name}da ${parking.availableSpaces} joy bo‘sh — oldindan band qiling.`,
						time: 'hozir',
					},
				]
			: []),
	]

	return (
		<div className='-mx-5 -mt-6 min-h-[calc(100dvh-var(--spacing-nav))] bg-canvas pb-28 pt-5'>
			<div className='mx-auto w-full max-w-md space-y-4'>
				<div className='px-4'>
					<AppBar
						title='Navbatlar'
						subtitle='Onlayn kuzating va oldindan oling'
						onBack={() => router.back()}
						action={
							<IconButton label='Qanday ishlaydi' onClick={() => setHowOpen(true)}>
								<HelpCircle className='size-[18px] text-ink-2' />
							</IconButton>
						}
					/>
				</div>

				<div className='px-4'>
					<SearchField
						value={query}
						onValueChange={setQuery}
						placeholder='Tashkilot yoki manzil…'
						aria-label='Tashkilot qidirish'
					/>
				</div>

				<HorizontalRail className='gap-2 px-4'>
					{CATEGORIES.map(item => {
						const count =
							item.id === 'all'
								? QUEUE_ORGS.length
								: QUEUE_ORGS.filter(o => o.category === item.id).length
						return (
							<Chip
								key={item.id}
								active={category === item.id}
								onClick={() =>
									setCategory(category === item.id ? 'all' : item.id)
								}
							>
								{item.label} · {count}
							</Chip>
						)
					})}
				</HorizontalRail>

				<div className='px-4'>
					<QueueOrgCard
						org={org}
						onSwitch={() => setSwitchOpen(true)}
						onDirections={() => directions.open({ from: 'queueOrg', orgId: org.id })}
					/>
				</div>

				<div className='px-4'>
					<QueueTicketCard
						org={org}
						// This organisation's own live ticket. Reading the first live
						// ticket anywhere hid it whenever another place's came first.
						ticket={findLiveQueueTicket(queueTickets, { orgId: org.id })}
						onTake={() => setTakeOpen(true)}
						onNotify={toast.show}
					/>
				</div>

				<div className='px-4'>
					<Card>
						<p className='text-[14px] font-bold text-ink'>Hozirgi navbat</p>
						<div className='mt-3 grid grid-cols-3 gap-2'>
							{[
								{ label: 'Navbatda', value: `${org.waiting}`, icon: Users },
								{ label: 'Kutish', value: `${org.waitMinutes} daq`, icon: Clock3 },
								{ label: 'Ishlayapti', value: `${org.windows} oyna`, icon: Users },
							].map(stat => (
								<div
									key={stat.label}
									className='rounded-xl bg-card-2 px-2 py-3 text-center'
								>
									<stat.icon className='mx-auto size-4 text-brand' />
									<p className='mt-1.5 text-[16px] font-black text-ink'>
										{stat.value}
									</p>
									<p className='mt-0.5 text-[10px] text-ink-3'>{stat.label}</p>
								</div>
							))}
						</div>
					</Card>
				</div>

				<div className='px-4'>
					<QueueForecastCard org={org} onTake={() => setTakeOpen(true)} />
				</div>

				<div className='px-4'>
					<SectionHeader title='Xizmatlar va oynalar' count={org.services.length} />
				</div>
				<div className='space-y-2 px-4'>
					{org.services.map(service => (
						<button
							key={service.id}
							type='button'
							onClick={() => setTakeOpen(true)}
							className='flex w-full items-center gap-3 rounded-card-lg bg-card p-3 text-left shadow-card'
						>
							<span className='grid size-10 shrink-0 place-items-center rounded-xl bg-card-2 font-mono text-[15px] font-black text-ink-2'>
								{service.prefix}
							</span>
							<span className='min-w-0 flex-1'>
								<span className='block truncate text-[14px] font-semibold text-ink'>
									{service.title}
								</span>
								<span className='mt-0.5 block text-[11px] text-ink-3'>
									{service.windows} oyna · kutish ~{service.avgWaitMinutes} daq
								</span>
							</span>
							<Badge
								tone={
									service.avgWaitMinutes < 15
										? 'ok'
										: service.avgWaitMinutes < 35
											? 'warn'
											: 'bad'
								}
							>
								{service.avgWaitMinutes} daq
							</Badge>
						</button>
					))}
				</div>

				<div className='px-4'>
					<Card>
						<div className='flex items-center justify-between gap-3'>
							<p className='text-[14px] font-bold text-ink'>Soatlar bo‘yicha</p>
							<Badge tone={peakLoad >= 90 ? 'bad' : 'warn'}>
								Eng gavjum {peakLoad}%
							</Badge>
						</div>
						<BarChart
							className='mt-3'
							bars={org.hourlyLoad.map((load, index) => ({
								label: QUEUE_HOURS[index],
								// A closed hour is a stub, not an empty queue.
								value: load === 0 ? 2 : load,
								tone: load === 0 ? 'bg-line' : occupancyTone(load),
							}))}
						/>
						<p className='mt-2 text-[11.5px] text-ink-3'>
							Eng tinch vaqt — {quietest?.label}. {org.closeTime} gacha ochiq.
						</p>
					</Card>
				</div>

				{parking && (
					<div className='px-4'>
						<button
							type='button'
							onClick={() => router.push(`/parking/${parking.id}`)}
							className='flex w-full items-center gap-3 rounded-card-lg bg-card p-3 text-left shadow-card'
						>
							<IconTile tone='bg-brand-50 text-brand'>
								<CircleParking className='size-[18px]' />
							</IconTile>
							<span className='min-w-0 flex-1'>
								<span className='block truncate text-[14px] font-semibold text-ink'>
									{parking.name}
								</span>
								<span className='mt-0.5 block text-[11px] text-ink-3'>
									Shu yerga yaqin parking · {parking.availableSpaces} ta bo‘sh
								</span>
							</span>
						</button>
					</div>
				)}

				<div className='px-4'>
					<SectionHeader title='Yaqin atrofdagi muqobillar' />
				</div>
				<div className='space-y-2 px-4'>
					{alternatives.map(item => {
						const faster = org.waitMinutes - item.waitMinutes
						return (
							<button
								key={item.id}
								type='button'
								onClick={() => {
									setOrgId(item.id)
									window.scrollTo({ top: 0, behavior: 'smooth' })
									toast.show(`${item.title} · ~${item.waitMinutes} daq`)
								}}
								className='flex w-full items-center gap-3 rounded-card-lg bg-card p-3 text-left shadow-card'
							>
								<IconTile
									tone={cn('bg-linear-to-br text-white/70', item.accent)}
								>
									<Users className='size-[18px]' />
								</IconTile>
								<span className='min-w-0 flex-1'>
									<span className='block truncate text-[14px] font-semibold text-ink'>
										{item.title}
									</span>
									<span className='mt-0.5 block text-[11px] text-ink-3'>
										{fromUser(item) !== null && `${formatDistance(fromUser(item)!)} · `}
										kutish ~
										{item.waitMinutes} daq
									</span>
								</span>
								<span
									className={cn(
										'shrink-0 text-[11px] font-bold',
										faster > 0 ? 'text-ok' : 'text-ink-3',
									)}
								>
									{faster > 0 ? `${faster} daq tezroq` : 'uzunroq'}
								</span>
							</button>
						)
					})}
				</div>

				{/* City Goo's queue notification list. These are generated from the
				    ticket you actually hold rather than hardcoded, so the section is
				    empty until there is something to be notified about. */}
				{queueNotices.length > 0 && (
					<>
						<div className='px-4'>
							<SectionHeader
								title='Bildirishnomalar'
								action={
									<span className='flex items-center gap-1'>
										<BellRing className='size-3.5' />
										{notificationPrefs.queueTurn ? 'Yoqilgan' : 'O‘chirilgan'}
									</span>
								}
								onAction={() => {
									const next = !notificationPrefs.queueTurn
									setNotificationPref('queueTurn', next)
									toast.show(
										next
											? 'Navbat haqida xabar beramiz'
											: 'Navbat bildirishnomalari o‘chirildi',
									)
								}}
							/>
						</div>
						<div className='space-y-2 px-4'>
							{queueNotices.map(notice => (
								<Card
									key={notice.title}
									className={cn(
										'flex items-start gap-3',
										!notificationPrefs.queueTurn && 'opacity-50',
									)}
								>
									<IconTile tone={notice.tone}>
										<notice.icon className='size-[18px]' />
									</IconTile>
									<div className='min-w-0 flex-1'>
										<div className='flex items-baseline justify-between gap-2'>
											<p className='truncate text-[13px] font-semibold text-ink'>
												{notice.title}
											</p>
											<span className='shrink-0 text-[11px] text-ink-3'>
												{notice.time}
											</span>
										</div>
										<p className='mt-1 text-[11.5px] leading-5 text-ink-3'>
											{notice.body}
										</p>
									</div>
								</Card>
							))}
						</div>
					</>
				)}

				{history.length > 0 && (
					<>
						<div className='px-4'>
							<SectionHeader title='Navbatlar tarixi' count={history.length} />
						</div>
						<div className='px-4'>
							<Card variant='bare'>
								{history.map((ticket, index) => {
									const ticketOrg = getQueueOrg(ticket.orgId)
									return (
										<div
											key={ticket.id}
											className={cn(
												'flex items-center gap-3 px-3.5 py-3',
												index > 0 && 'border-t border-line',
											)}
										>
											<span className='grid size-10 shrink-0 place-items-center rounded-xl bg-card-2 font-mono text-[13px] font-black text-ink-2'>
												{ticket.number}
											</span>
											<span className='min-w-0 flex-1'>
												<span className='block truncate text-[13.5px] font-semibold text-ink'>
													{ticketOrg?.title ?? 'Navbat'}
												</span>
												<span className='mt-0.5 block text-[11px] text-ink-3'>
													{ticket.initialEtaMinutes} daqiqa kutilgan
												</span>
											</span>
											<Badge tone={ticket.status === 'served' ? 'ok' : 'gray'}>
												{ticket.status === 'served' ? 'Xizmat ko‘rsatildi' : 'Bekor qilindi'}
											</Badge>
										</div>
									)
								})}
							</Card>
						</div>
					</>
				)}
			</div>

			{takeOpen && (
				<TakeTicketSheet
					org={org}
					onClose={() => setTakeOpen(false)}
				/>
			)}

			{switchOpen && (
				<BottomSheet title='Tashkilotni tanlang' onClose={() => setSwitchOpen(false)}>
					<div className='space-y-2'>
						{filtered.map(item => (
							<button
								key={item.id}
								type='button'
								onClick={() => {
									setOrgId(item.id)
									setSwitchOpen(false)
								}}
								className='flex w-full items-center gap-3 rounded-card-lg bg-card p-3 text-left shadow-card'
							>
								<IconTile
									tone={cn('bg-linear-to-br text-white/70', item.accent)}
								>
									<Users className='size-[18px]' />
								</IconTile>
								<span className='min-w-0 flex-1'>
									<span className='block truncate text-[14px] font-semibold text-ink'>
										{item.title}
									</span>
									<span className='mt-0.5 block text-[11px] text-ink-3'>
										{item.address} · {item.waiting} kishi
									</span>
								</span>
								<Badge
									tone={
										item.waitMinutes < 15
											? 'ok'
											: item.waitMinutes < 35
												? 'warn'
												: 'bad'
									}
								>
									{item.waitMinutes} daq
								</Badge>
							</button>
						))}
						{filtered.length === 0 && (
							<Card className='text-center'>
								<p className='text-[13px] text-ink-3'>Hech narsa topilmadi</p>
							</Card>
						)}
					</div>
				</BottomSheet>
			)}

			{howOpen && (
				<BottomSheet
					title='Elektron navbat qanday ishlaydi'
					onClose={() => setHowOpen(false)}
				>
					<div className='space-y-2'>
						{HOW_IT_WORKS.map((step, index) => (
							<Card key={step} className='flex items-start gap-3'>
								<span className='grid size-7 shrink-0 place-items-center rounded-full bg-brand text-[12px] font-black text-white'>
									{index + 1}
								</span>
								<p className='text-[13px] leading-5 text-ink-2'>{step}</p>
							</Card>
						))}
					</div>
					<Button
						variant='primary'
						block
						className='mt-4'
						onClick={() => setHowOpen(false)}
					>
						Tushunarli
					</Button>
				</BottomSheet>
			)}

			<Toast open={toast.open} message={toast.payload ?? ''} />
		</div>
	)
}
