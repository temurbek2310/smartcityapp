'use client'

import {
	Bell,
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
	center?: boolean
}[] = [
	{ href: '/home', label: 'Bosh sahifa', icon: Home },
	{ href: '/favorites', label: 'Sevimlilar', icon: Heart },
	{ href: '/bookings', label: 'Bron', icon: CalendarDays, center: true },
	{ href: '/notifications', label: 'Xabarlar', icon: Bell },
	{ href: '/profile', label: 'Profil', icon: UserRound },
]

export function BottomNavigation() {
	const pathname = usePathname()

	return (
		<nav className='fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-md border-t border-slate-200 bg-white/95 pb-[max(.45rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl'>
			<ul className='grid grid-cols-5 items-start'>
				{items.map(item => {
					const active =
						pathname === item.href ||
						(item.href === '/bookings' &&
							(pathname.startsWith('/reservation') ||
								pathname.startsWith('/reserve') ||
								pathname.startsWith('/session') ||
								pathname.startsWith('/receipt')))
					const Icon = item.icon

					if (item.center) {
						return (
							<li key={item.href} className='flex justify-center'>
								<Link
									href={item.href}
									className='-mt-5 flex min-h-16 flex-col items-center gap-1 text-[10px] font-black text-violet-600'
								>
									<span className='grid size-14 place-items-center rounded-[19px] bg-linear-to-br from-violet-500 to-violet-700 text-white shadow-xl shadow-violet-600/35'>
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
								className={`flex min-h-14 flex-col items-center justify-center gap-1 text-[10px] font-semibold transition ${active ? 'text-violet-600' : 'text-slate-400'}`}
							>
								<Icon
									className={`size-5 ${active && item.href === '/favorites' ? 'fill-violet-50' : ''}`}
								/>
								<span>{item.label}</span>
							</Link>
						</li>
					)
				})}
			</ul>
		</nav>
	)
}
