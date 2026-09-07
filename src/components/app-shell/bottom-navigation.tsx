'use client'

import {
	CalendarDays,
	Heart,
	Home,
	UserRound,
	type LucideIcon,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const items: {
	href: string
	label: string
	icon: LucideIcon
}[] = [
	{ href: '/home', label: 'Home', icon: Home },
	{ href: '/bookings', label: 'Bookings', icon: CalendarDays },
	{ href: '/favorites', label: 'Favorites', icon: Heart },
	{ href: '/profile', label: 'Profile', icon: UserRound },
]

export function BottomNavigation() {
	const pathname = usePathname()

	return (
		<nav className='fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-md border-t border-slate-200 bg-white/95 px-2 pb-[max(.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur'>
			<ul className='grid grid-cols-4 gap-1'>
				{items.map(item => {
					const active =
						pathname === item.href ||
						(item.href === '/bookings' && pathname.startsWith('/reservation'))

					const Icon = item.icon

					return (
						<li key={item.href}>
							<Link
								href={item.href}
								className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl text-[10px] font-semibold transition ${
									active
										? 'bg-slate-950 text-white'
										: 'text-slate-500 hover:bg-slate-100'
								}`}
							>
								<Icon className='size-5' />
								<span>{item.label}</span>
							</Link>
						</li>
					)
				})}
			</ul>
		</nav>
	)
}
