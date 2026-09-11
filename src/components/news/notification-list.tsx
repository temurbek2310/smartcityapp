'use client'

import {
	Bell,
	CalendarCheck,
	CircleParking,
	Clock3,
	Users,
	Wallet,
	type LucideIcon,
} from 'lucide-react'

import { EmptyState } from '@/components/ui/empty-state'
import { IconTile } from '@/components/ui/icon-tile'
import { useApp } from '@/context/app-context'
import { cn } from '@/lib/cn'
import { formatDateTime } from '@/lib/format'
import type { AppNotification } from '@/lib/types'

// Lifted out of /notifications so the news screen can render it as a tab.
// Same data, same actions — only the surface it lives on changed.
const ICONS: Record<AppNotification['type'], LucideIcon> = {
	booking: CalendarCheck,
	timer: Clock3,
	parking: CircleParking,
	payment: Wallet,
	queue: Users,
	system: Bell,
}

const TONES: Record<AppNotification['type'], string> = {
	booking: 'bg-brand-50 text-brand',
	timer: 'bg-warn-bg text-warn',
	parking: 'bg-ok-bg text-ok',
	payment: 'bg-info-bg text-info',
	queue: 'bg-brand-50 text-brand',
	system: 'bg-card-2 text-ink-2',
}

export function NotificationList() {
	const { notifications, markNotificationRead } = useApp()

	if (!notifications.length) {
		return (
			<EmptyState
				icon={Bell}
				title='Bildirishnoma yo‘q'
				text='Bron, navbat va parking haqidagi xabarlar shu yerda ko‘rinadi.'
				href='/parking'
				action='Parking topish'
			/>
		)
	}

	return (
		<div className='space-y-2'>
			{notifications.map(notification => {
				const Icon = ICONS[notification.type] ?? Bell
				return (
					<button
						key={notification.id}
						type='button'
						onClick={() => markNotificationRead(notification.id)}
						className={cn(
							'w-full rounded-card-lg bg-card p-3 text-left shadow-card transition-opacity',
							notification.read && 'opacity-60',
						)}
					>
						<div className='flex items-start gap-3'>
							<IconTile tone={TONES[notification.type] ?? TONES.system}>
								<Icon className='size-[18px]' />
							</IconTile>

							<div className='min-w-0 flex-1'>
								<div className='flex items-start justify-between gap-2'>
									<p className='min-w-0 text-[14px] font-bold text-ink'>
										{notification.title}
									</p>
									<span className='shrink-0 text-[10.5px] text-ink-3'>
										{formatDateTime(notification.createdAt)}
									</span>
								</div>
								<p className='mt-1 text-[12px] leading-[1.45] text-ink-2'>
									{notification.message}
								</p>
							</div>

							{!notification.read && (
								<span className='mt-1.5 size-2 shrink-0 rounded-full bg-brand' />
							)}
						</div>
					</button>
				)
			})}
		</div>
	)
}
