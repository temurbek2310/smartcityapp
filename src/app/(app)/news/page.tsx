'use client'

import {
	CalendarClock,
	CheckCheck,
	CircleParking,
	Construction,
	Heart,
	Info,
	Navigation,
	OctagonAlert,
	TriangleAlert,
	type LucideIcon,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useState } from 'react'

import { NotificationList } from '@/components/news/notification-list'
import { Badge, type BadgeTone } from '@/components/ui/badge'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Chip } from '@/components/ui/chip'
import { HorizontalRail } from '@/components/ui/horizontal-rail'
import { IconTile } from '@/components/ui/icon-tile'
import { LoadingScreen } from '@/components/ui/loading-screen'
import { SectionHeader } from '@/components/ui/section-header'
import { Toast } from '@/components/ui/toast'
import { useApp } from '@/context/app-context'
import { EVENTS } from '@/data/events'
import { NEWS } from '@/data/news'
import { getParking } from '@/data/parkings'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/cn'
import type { NewsItem, NewsSeverity } from '@/lib/types'

const SEVERITY_ICON: Record<NewsSeverity, LucideIcon> = {
	closure: OctagonAlert,
	roadworks: Construction,
	incident: TriangleAlert,
	info: Info,
}

const SEVERITY_TONE: Record<NewsSeverity, { tile: string; badge: BadgeTone }> = {
	closure: { tile: 'bg-bad-bg text-bad', badge: 'bad' },
	roadworks: { tile: 'bg-warn-bg text-warn', badge: 'warn' },
	incident: { tile: 'bg-warn-bg text-warn', badge: 'warn' },
	info: { tile: 'bg-info-bg text-info', badge: 'info' },
}

const SEVERITY_LABEL: Record<NewsSeverity, string> = {
	closure: 'Yopilgan',
	roadworks: 'Ta’mir',
	incident: 'Hodisa',
	info: 'Yangilik',
}

type NewsTab = 'all' | 'events' | 'roads' | 'notifications'

const NEWS_TABS: NewsTab[] = ['all', 'events', 'roads', 'notifications']

function isNewsTab(value: string | null): value is NewsTab {
	return value !== null && (NEWS_TABS as string[]).includes(value)
}

export default function NewsPage() {
	return (
		<Suspense fallback={<LoadingScreen />}>
			<NewsView />
		</Suspense>
	)
}

function NewsView() {
	const router = useRouter()
	const toast = useToast<string>()
	const params = useSearchParams()
	const {
		unreadCount,
		markAllNotificationsRead,
		favoriteEvents,
		toggleEventFavorite,
	} = useApp()

	// /notifications redirects here with ?tab=notifications, so old bell links
	// keep landing where the user expects; /parking links to ?tab=roads and
	// /map to ?tab=events, so every tab is addressable rather than just one.
	const requested = params.get('tab')
	const [tab, setTab] = useState<NewsTab>(isNewsTab(requested) ? requested : 'all')
	const [openItem, setOpenItem] = useState<NewsItem | null>(null)

	const roads = NEWS.filter(item => item.category === 'road')

	const tabs: { id: NewsTab; label: string; count: number }[] = [
		{ id: 'all', label: 'Barchasi', count: NEWS.length + EVENTS.length },
		{ id: 'events', label: 'Voqealar', count: EVENTS.length },
		{ id: 'roads', label: 'Yo‘llar', count: roads.length },
		{ id: 'notifications', label: 'Bildirishnomalar', count: unreadCount },
	]

	return (
		<div className='-mx-5 -mt-6 min-h-[calc(100dvh-var(--spacing-nav))] bg-canvas pb-28 pt-5'>
			<div className='mx-auto w-full max-w-md space-y-4'>
				<div className='flex items-start justify-between gap-3 px-4'>
					<div className='min-w-0'>
						<h1 className='text-[22px] font-black tracking-[-0.02em] text-ink'>
							Yangiliklar
						</h1>
						<p className='mt-1 text-[12.5px] text-ink-3'>
							Shahar, yo‘llar va bildirishnomalaringiz
						</p>
					</div>
					{unreadCount > 0 && (
						<Button
							size='xs'
							variant='outline'
							onClick={() => {
								markAllNotificationsRead()
								toast.show('Barcha bildirishnomalar o‘qildi')
							}}
						>
							<CheckCheck className='size-3.5' /> {unreadCount}
						</Button>
					)}
				</div>

				<HorizontalRail className='gap-2 px-4'>
					{tabs.map(item => (
						<Chip
							key={item.id}
							active={tab === item.id}
							onClick={() => setTab(item.id)}
						>
							{item.label} · {item.count}
						</Chip>
					))}
				</HorizontalRail>

				<div className='space-y-3 px-4'>
					{tab === 'notifications' ? (
						<NotificationList />
					) : tab === 'events' ? (
						EVENTS.map(event => (
							<EventCard
								key={event.id}
								event={event}
								saved={favoriteEvents.includes(event.id)}
								onToggle={() => {
									toggleEventFavorite(event.id)
									toast.show(
										favoriteEvents.includes(event.id)
											? 'Sevimlilardan olib tashlandi'
											: 'Voqea sevimlilarga saqlandi',
									)
								}}
							/>
						))
					) : tab === 'roads' ? (
						roads.map(item => (
							<NewsCard key={item.id} item={item} onOpen={() => setOpenItem(item)} />
						))
					) : (
						<>
							<SectionHeader title='Yo‘llar va shahar' />
							{NEWS.slice(0, 3).map(item => (
								<NewsCard
									key={item.id}
									item={item}
									onOpen={() => setOpenItem(item)}
								/>
							))}

							<SectionHeader title='Yaqin voqealar' className='pt-2' />
							{EVENTS.slice(0, 2).map(event => (
								<EventCard
									key={event.id}
									event={event}
									saved={favoriteEvents.includes(event.id)}
									onToggle={() => {
										toggleEventFavorite(event.id)
										toast.show(
											favoriteEvents.includes(event.id)
												? 'Sevimlilardan olib tashlandi'
												: 'Voqea sevimlilarga saqlandi',
										)
									}}
								/>
							))}
						</>
					)}
				</div>
			</div>

			{openItem && (
				<BottomSheet title={openItem.title} onClose={() => setOpenItem(null)}>
					<Card>
						<div className='flex items-start gap-3'>
							<IconTile tone={SEVERITY_TONE[openItem.severity].tile}>
								{(() => {
									const Icon = SEVERITY_ICON[openItem.severity]
									return <Icon className='size-[18px]' />
								})()}
							</IconTile>
							<div className='min-w-0 flex-1'>
								<p className='text-[13.5px] font-semibold text-ink'>
									{openItem.summary}
								</p>
								<p className='mt-1 text-[11px] text-ink-3'>
									{openItem.timeLabel}
								</p>
							</div>
						</div>
					</Card>

					<Card className='mt-3'>
						<p className='text-[13px] leading-5 text-ink-2'>{openItem.body}</p>
						{openItem.detourAdvice && (
							<p className='mt-3 text-[12.5px] font-semibold text-ink'>
								{openItem.detourAdvice}
							</p>
						)}
					</Card>

					{/* The reason this feed belongs in a parking app: a closure names
					    the lots it reaches, so the item ends somewhere actionable
					    instead of being read and dismissed. */}
					{openItem.affectedParkingIds.length > 0 && (
						<>
							<p className='mt-4 px-1 text-[12px] font-bold text-ink-2'>
								Ta’sirlangan parkinglar
							</p>
							<div className='mt-2 space-y-2'>
								{openItem.affectedParkingIds.map(id => {
									const parking = getParking(id)
									if (!parking) return null
									return (
										<Link
											key={id}
											href={`/parking/${id}`}
											className='flex items-center gap-3 rounded-card-lg bg-card p-3 shadow-card'
										>
											<IconTile tone='bg-brand-50 text-brand'>
												<CircleParking className='size-[18px]' />
											</IconTile>
											<span className='min-w-0 flex-1'>
												<span className='block truncate text-[14px] font-semibold text-ink'>
													{parking.name}
												</span>
												<span className='mt-0.5 block text-[11px] text-ink-3'>
													{parking.availableSpaces} ta bo‘sh joy
												</span>
											</span>
										</Link>
									)
								})}
							</div>
						</>
					)}

					{openItem.category === 'road' ? (
						<Button
							variant='primary'
							block
							className='mt-4'
							onClick={() => {
								setOpenItem(null)
								router.push('/transport?mode=car')
							}}
						>
							<Navigation className='size-4' /> Aylanma yo‘l qurish
						</Button>
					) : (
						<Button
							variant='primary'
							block
							className='mt-4'
							onClick={() => setOpenItem(null)}
						>
							Tushunarli
						</Button>
					)}
				</BottomSheet>
			)}

			<Toast open={toast.open} message={toast.payload ?? ''} />
		</div>
	)
}

function NewsCard({ item, onOpen }: { item: NewsItem; onOpen: () => void }) {
	const Icon = SEVERITY_ICON[item.severity]
	const tone = SEVERITY_TONE[item.severity]

	return (
		<button
			type='button'
			onClick={onOpen}
			className='flex w-full items-start gap-3 rounded-card-lg bg-card p-3 text-left shadow-card'
		>
			<IconTile tone={tone.tile}>
				<Icon className='size-[18px]' />
			</IconTile>
			<span className='min-w-0 flex-1'>
				<span className='flex items-start justify-between gap-2'>
					<span className='min-w-0 text-[14px] font-bold text-ink'>
						{item.title}
					</span>
					<span className='shrink-0 text-[10.5px] text-ink-3'>
						{item.timeLabel}
					</span>
				</span>
				<span className='mt-1 block text-[12px] leading-[1.45] text-ink-2'>
					{item.summary}
				</span>
				<span className='mt-2 flex items-center gap-2'>
					<Badge tone={tone.badge}>{SEVERITY_LABEL[item.severity]}</Badge>
					{item.affectedParkingIds.length > 0 && (
						<span className='text-[10.5px] text-ink-3'>
							{item.affectedParkingIds.length} ta parkingga ta’sir qiladi
						</span>
					)}
				</span>
			</span>
		</button>
	)
}

function EventCard({
	event,
	saved,
	onToggle,
}: {
	event: (typeof EVENTS)[number]
	saved: boolean
	onToggle: () => void
}) {
	return (
		<article className='overflow-hidden rounded-card-lg bg-card shadow-card'>
			<div
				className={cn(
					'flex h-26 items-end justify-between bg-linear-to-br p-3',
					event.accent,
				)}
			>
				<span className='rounded-[7px] bg-white/90 px-2 py-1 text-[10px] font-extrabold text-ink'>
					{event.when}, {event.time}
				</span>
				<span className='rounded-[7px] bg-white/90 px-2 py-1 text-[10px] font-extrabold text-ink-2'>
					{event.category}
				</span>
			</div>
			<div className='p-3'>
				<div className='flex items-start justify-between gap-2'>
					<div className='min-w-0'>
						<p className='truncate text-[15px] font-extrabold text-ink'>
							{event.title}
						</p>
						<p className='mt-0.5 flex items-center gap-1.5 text-[11px] text-ink-3'>
							<CalendarClock className='size-3' /> {event.place} · {event.price}
						</p>
					</div>
					<button
						type='button'
						aria-label={saved ? 'Sevimlilardan olib tashlash' : 'Sevimlilarga saqlash'}
						onClick={onToggle}
						className='grid size-9 shrink-0 place-items-center rounded-xl bg-card-2'
					>
						<Heart
							className={cn('size-4', saved ? 'fill-bad text-bad' : 'text-ink-3')}
						/>
					</button>
				</div>

				<Link
					href={`/parking/${event.parkingId}`}
					className='mt-3 flex h-9 items-center justify-center gap-1.5 rounded-[10px] border-[1.5px] border-line-2 bg-white text-[11.5px] font-bold text-ink'
				>
					<CircleParking className='size-3.5' /> Yaqin parking
				</Link>
			</div>
		</article>
	)
}
