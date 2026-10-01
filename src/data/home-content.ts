import {
	Building2,
	CalendarDays,
	Car,
	CircleParking,
	History,
	Hospital,
	type LucideIcon,
	MapPin,
	ShoppingBag,
	Sparkles,
	Store,
	Ticket,
	Utensils,
	Wrench,
} from 'lucide-react'

import type { PlaceCategory } from '@/lib/types'

// Home's static content, lifted out of the page so the screen is a
// composition rather than a 2,300-line file. Moved verbatim — the ordering,
// copy and tones are exactly what shipped.

export type ServiceItem = {
	id: string
	label: string
	subtitle: string
	icon: LucideIcon
	tone: string
}

export const CATEGORIES: {
	id: PlaceCategory | 'transport' | 'queues' | 'more'
	label: string
	icon: LucideIcon
	tone: string
}[] = [
	{
		id: 'all',
		label: 'Barchasi',
		icon: Store,
		tone: 'bg-brand-50 text-brand',
	},
	{
		id: 'food',
		label: 'Ovqat',
		icon: Utensils,
		tone: 'bg-warn-bg text-warn',
	},
	{
		id: 'parking',
		label: 'Parking',
		icon: CircleParking,
		tone: 'bg-brand-50 text-brand',
	},
	{
		id: 'health',
		label: 'Sog‘liq',
		icon: Hospital,
		tone: 'bg-bad-bg text-bad',
	},
	{
		id: 'shops',
		label: 'Do‘konlar',
		icon: ShoppingBag,
		tone: 'bg-ok-bg text-ok',
	},
	{
		id: 'fun',
		label: 'Ko‘ngilochar',
		icon: Ticket,
		tone: 'bg-brand-100 text-brand',
	},
	{
		id: 'buildings',
		label: 'Binolar',
		icon: Building2,
		tone: 'bg-info-bg text-info',
	},
	{
		id: 'services',
		label: 'Xizmatlar',
		icon: Wrench,
		tone: 'bg-brand-50 text-brand',
	},
	{
		id: 'tourism',
		label: 'Turizm',
		icon: MapPin,
		tone: 'bg-ok-bg text-ok',
	},
	{
		id: 'transport',
		label: 'Transport',
		icon: Car,
		tone: 'bg-info-bg text-info',
	},
	{
		id: 'queues',
		label: 'Navbatlar',
		icon: History,
		tone: 'bg-warn-bg text-warn',
	},
	{
		id: 'more',
		label: 'Yana',
		icon: Sparkles,
		tone: 'bg-card-2 text-ink-3',
	},
]

export const SERVICES: ServiceItem[] = [
	{
		id: 'table',
		label: 'Stol band qilish',
		subtitle: 'Stol va parkingni birga rejalang',
		icon: CalendarDays,
		tone: 'text-warn',
	},
	{
		id: 'parking',
		label: 'Parking',
		subtitle: 'Joyni oldindan band qiling',
		icon: CircleParking,
		tone: 'text-brand',
	},
	{
		id: 'cinema',
		label: 'Kino chiptasi',
		subtitle: 'Joy tanlash va chipta',
		icon: Ticket,
		tone: 'text-info',
	},
	{
		id: 'clinic',
		label: 'Shifokor qabuliga yozilish',
		subtitle: 'Bugungi bo‘sh vaqtlar',
		icon: Hospital,
		tone: 'text-bad',
	},
	{
		id: 'queue',
		label: 'Elektron navbat',
		subtitle: 'Uydan turib navbat oling',
		icon: History,
		tone: 'text-warn',
	},
	{
		id: 'taxi',
		label: 'Taksi',
		subtitle: 'Kelish vaqti 3–5 daqiqa',
		icon: Car,
		tone: 'text-ok',
	},
]

export const AI_TIPS = [
	{
		title: 'Parkingni hozirroq band qiling',
		text: 'Kechki payt markazdagi parkinglar tezroq to‘ladi. Hozir bo‘sh joy ko‘proq.',
		action: 'Parking tanlash',
		parkingId: 'tashkent-city',
	},
	{
		title: 'Magic City uchun yaxshi vaqt',
		text: 'Hozir mavjud joylar yetarli, kechga yaqin yuklama oshadi.',
		action: 'Band qilish',
		parkingId: 'magic-city',
	},
	{
		title: 'Markazga yo‘l',
		text: 'Tashkent City Parking markazdagi eng ko‘p bo‘sh joyga ega variantlardan biri.',
		action: 'Yo‘nalish',
		parkingId: 'tashkent-city',
	},
	{
		title: 'Yaqin alternativ',
		text: 'Agar parking TO‘LA bo‘lsa, ilova mavjud bo‘sh joyli alternativni ko‘rsatadi.',
		action: 'Xaritada ko‘rish',
		parkingId: 'amir-temur',
	},
]
