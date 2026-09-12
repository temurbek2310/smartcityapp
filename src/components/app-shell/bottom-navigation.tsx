'use client'

import {
	Newspaper,
	CalendarDays,
	Heart,
	Home,
	UserRound,
	type LucideIcon,
} from 'lucide-react'
import Link from 'next/link'

import { useApp } from '@/context/app-context'
import { usePathname } from 'next/navigation'

const items: {
	href: string
	label: string
	icon: LucideIcon
	center?: boolean
}[] = [
	{ href: '/home', label: 'Bosh sahifa', icon: Home },
	{ href: '/favorites', label: 'Sevimlilar', icon: Heart },
	{ href: '/bookings', label: 'Bron', icon: CalendarDays, center: true },
	{ href: '/news', label: 'Yangiliklar', icon: Newspaper },
	{ href: '/profile', label: 'Profil', icon: UserRound },
]

export function BottomNavigation() {
	const pathname = usePathname()
	// The unread count used to show only in the headers, which the screens
	// that own their own header never render. On the nav it is always visible.
	const { unreadCount } = useApp()

	return (
		<nav className='fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-md border-t border-line bg-white/95 pb-[max(.45rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl'>
			<ul className='grid grid-cols-5 items-start'>
				{items.map(item => {
					const active =
						pathname === item.href ||
						(item.href === '/bookings' &&
							(pathname.startsWith('/reservation') ||
								pathname.startsWith('/session') ||
								pathname.startsWith('/receipt'))) ||
						// /notifications now redirects into this tab.
						(item.href === '/news' && pathname === '/notifications')
					const Icon = item.icon
					const badge = item.href === '/news' ? unreadCount : 0

					if (item.center) {
						return (
							<li key={item.href} className='flex justify-center'>
								<Link
									href={item.href}
									className='-mt-5 flex min-h-16 flex-col items-center gap-1 text-[10px] font-black text-brand'
								>
									<span className='grid size-14 place-items-center rounded-[19px] bg-brand text-white shadow-xl shadow-[0_10px_28px_rgb(108_71_224/.32)]'>
										<Icon className='size-6' />
									</span>
									<span>{item.label}</span>
								</Link>
							</li>
						)
					}

					return (
						<li key={item.href}>
							<Link
								href={item.href}
								className={`flex min-h-14 flex-col items-center justify-center gap-1 text-[10px] font-semibold transition ${active ? 'text-brand' : 'text-ink-3'}`}
							>
								<span className='relative'>
									<Icon
										className={`size-5 ${active && item.href === '/favorites' ? 'fill-brand-50' : ''}`}
									/>
									{badge > 0 && (
										<span className='absolute -right-2 -top-1.5 grid min-w-4 place-items-center rounded-full border-2 border-white bg-bad px-1 text-[9px] font-black leading-3.5 text-white'>
											{badge > 9 ? '9+' : badge}
										</span>
									)}
								</span>
								<span>{item.label}</span>
							</Link>
						</li>
					)
				})}
			</ul>
		</nav>
	)
}
