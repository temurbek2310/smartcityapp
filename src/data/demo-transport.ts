import {
	Ban,
	BatteryCharging,
	Bike,
	Camera,
	CircleDot,
	Construction,
	Eye,
	Flame,
	Footprints,
	Gauge,
	LocateFixed,
	Navigation,
	ShoppingBag,
	Smile,
	TriangleAlert,
	Users,
	type LucideIcon,
} from 'lucide-react'

import type { TransportMode } from '@/lib/transport'

// ---------------------------------------------------------------------
// Demo / reference-only content for the /transport screen.
//
// B SPACE has no live traffic-camera, road-hazard, GTFS or weather feed —
// City Goo's Transport screen assumes one. Everything exported from this
// file is illustrative content that reproduces that screen's layout only;
// it is never wired up as if it came from a real backend. Anything B SPACE
// actually has (parking availability, the selected city's weather
// snapshot, computed distance/ETA) is read from real data in
// src/app/(app)/transport/page.tsx instead of living here.
// ---------------------------------------------------------------------

export type RouteFactRow = {
	icon: LucideIcon
	label: string
	value: string
	sublabel?: string
	explain: string
}

// Route-summary rows that only make sense for one transport mode (traffic
// lights for a car, wagon load for the metro, battery for a scooter...).
// Time, distance and destination-parking rows are real and injected by the
// page, not stored here.
export const DEMO_ROUTE_FACTS: Record<TransportMode, RouteFactRow[]> = {
	car: [
		{
			icon: CircleDot,
			label: 'Svetoforlar',
			value: '12',
			explain: '58–60 km/soat tezlikni ushlab tursangiz, aksariyatidan to‘xtamay o‘tasiz.',
		},
		{
			icon: Camera,
			label: 'Tezlik kameralari',
			value: '6',
			sublabel: '60 km/soat',
			explain: 'Har bir kameradan 300 metr oldin ilova ogohlantiradi.',
		},
		{
			icon: Eye,
			label: 'Yo‘lak nazorati kameralari',
			value: '2',
			explain: 'Jamoat transporti uchun ajratilgan yo‘lakka chiqishni qayd etadi.',
		},
		{
			icon: TriangleAlert,
			label: 'Qizilga chiqish nazorati',
			value: '1',
			explain: 'Taqiqlovchi signalda chorrahadan o‘tishni qayd etadigan kamera.',
		},
		{
			icon: TriangleAlert,
			label: 'Sun’iy notekisliklar',
			value: '4',
			explain: 'Tavsiya etilgan tezlik — soatiga 20 km gacha.',
		},
		{
			icon: Construction,
			label: 'Yo‘l ishlari',
			value: '1 uchastka',
			sublabel: '1,2 km',
			explain: 'Bir qatorga toraytirilgan, 30 mayga qadar davom etadi.',
		},
		{
			icon: Ban,
			label: 'Yopiq yo‘laklar',
			value: '1',
			explain: 'Avariya ishlari tufayli bitta yo‘lak yopiq, ~3 daqiqa kechikish.',
		},
		{
			icon: Gauge,
			label: 'Yo‘l sifati',
			value: 'Yaxshi',
			explain: 'Sensor va haydovchi murojaatlariga asoslangan baho.',
		},
	],
	metro: [
		{
			icon: Users,
			label: 'Bandlik',
			value: '28%',
			sublabel: 'bo‘sh joy bor',
			explain: 'Tavsiya etilgan vagon — 2 yoki 3, u yerda bo‘shroq.',
		},
		{
			icon: Footprints,
			label: 'Piyoda qism',
			value: '1,1 km',
			sublabel: '≈12 daqiqa',
			explain: 'Bekatgacha va bekatdan manzilgacha piyoda yurish masofasi.',
		},
		{
			icon: CircleDot,
			label: 'O‘tish joyi',
			value: '1',
			sublabel: '≈2 daqiqa',
			explain: 'Liniyalar orasidagi almashish vaqti, yer osti yo‘lagi orqali.',
		},
	],
	scooter: [
		{
			icon: BatteryCharging,
			label: 'Skuter zaryadi',
			value: '75%',
			sublabel: 'zaxira bilan yetadi',
			explain: 'Marshrut uchun taxminan 38% zaryad kerak bo‘ladi.',
		},
		{
			icon: Bike,
			label: 'Velodoʻrajka bo‘ylab',
			value: '90%',
			explain: 'Marshrutning katta qismi ajratilgan velo-yo‘lakdan o‘tadi.',
		},
		{
			icon: TriangleAlert,
			label: 'Xavfli kesishmalar',
			value: '1',
			explain: 'Kesishmada piyoda o‘tish joyidan foydalanib, piyoda bo‘ling.',
		},
	],
	walk: [
		{
			icon: Footprints,
			label: 'Qadamlar',
			value: '≈4 800',
			explain: 'Tanlangan yo‘nalish bo‘yicha taxminiy qadamlar soni.',
		},
		{
			icon: Flame,
			label: 'Energiya sarfi',
			value: '≈210 kkal',
			explain: 'O‘rtacha yurish tezligiga asoslangan taxminiy hisob.',
		},
		{
			icon: Gauge,
			label: 'Piyodalar yo‘lagi',
			value: 'Yaxshi',
			explain: 'Yo‘lakning katta qismi tekis va soyali.',
		},
		{
			icon: TriangleAlert,
			label: 'O‘tish joylari',
			value: '7',
			sublabel: '2 tasi svetoforsiz',
			explain: 'Svetoforsiz o‘tish joylarida alohida ehtiyot bo‘ling.',
		},
	],
}

export type TimelineStepTemplate = {
	icon: LucideIcon
	tone: string
	title: string
	subtitle: string
	note: string
	/** Position along the real route, 0 (start) – 1 (destination), exclusive. */
	atFraction: number
}

// Intermediate waypoints only — the page injects the real "Start" step at
// fraction 0 (using the real origin) and the real destination step at
// fraction 1 (using the real parking). Distances shown are the fraction
// multiplied by the real computed distance, so they always add up.
export const DEMO_ROUTE_TIMELINE: Record<TransportMode, TimelineStepTemplate[]> = {
	car: [
		{
			icon: CircleDot,
			tone: '#F04438',
			title: '3 svetofor',
			subtitle: 'Nukusskaya ko‘chasi',
			note: '58–60 km/soat tezlikni ushlab turing — barchasidan to‘xtamay o‘tasiz.',
			atFraction: 0.17,
		},
		{
			icon: Camera,
			tone: '#475069',
			title: 'Kamera 60 km/soat',
			subtitle: 'Nukusskaya ko‘chasi, 40-uy',
			note: 'Tezlik nazorati kamerasi. Ruxsat etilgan tezlik — 60 km/soat.',
			atFraction: 0.34,
		},
		{
			icon: Construction,
			tone: '#F79009',
			title: 'Yo‘l ishlari',
			subtitle: 'Bunyodkor shoh ko‘chasi',
			note: 'Bir qatorga toraytirilgan, kechikish ≈3 daqiqa.',
			atFraction: 0.51,
		},
		{
			icon: TriangleAlert,
			tone: '#8A91A6',
			title: 'Sun’iy notekisliklar',
			subtitle: 'Sayilgoh ko‘chasi',
			note: 'Ketma-ket 4 ta notekislik. Tezlikni 20 km/soatgacha tushiring.',
			atFraction: 0.78,
		},
	],
	metro: [
		{
			icon: Footprints,
			tone: '#8A91A6',
			title: 'Piyoda ≈6 daqiqa',
			subtitle: 'Mustaqillik bekatigacha',
			note: 'Buyuk Ipak Yo‘li ko‘chasi bo‘ylab to‘g‘ri, so‘ng o‘ngga.',
			atFraction: 0.14,
		},
		{
			icon: CircleDot,
			tone: '#12B76A',
			title: 'Chilonzor liniyasi',
			subtitle: '4 bekat',
			note: 'Bandlik 28%. Tavsiya etilgan vagon — 2 yoki 3.',
			atFraction: 0.4,
		},
		{
			icon: Footprints,
			tone: '#F79009',
			title: 'O‘tish',
			subtitle: 'Alisher Navoiy bekati',
			note: 'Yer osti yo‘lagi orqali o‘tish, ≈180 metr.',
			atFraction: 0.58,
		},
		{
			icon: CircleDot,
			tone: '#7C3AED',
			title: 'O‘zbekiston liniyasi',
			subtitle: '2 bekat',
			note: 'Bandlik 45%. Chiqish — poyezd oxirida.',
			atFraction: 0.8,
		},
	],
	scooter: [
		{
			icon: Bike,
			tone: '#2E90FA',
			title: 'Velodoʻrajka',
			subtitle: 'Nukusskaya ko‘chasi bo‘ylab',
			note: 'Ajratilgan polosa, qoplama tekis.',
			atFraction: 0.3,
		},
		{
			icon: TriangleAlert,
			tone: '#F04438',
			title: 'Kesishma',
			subtitle: 'Bunyodkor shoh ko‘chasi',
			note: 'Piyoda o‘ting: piyodalar o‘tish joyidan foydalaning.',
			atFraction: 0.55,
		},
		{
			icon: Bike,
			tone: '#2E90FA',
			title: 'Velodoʻrajka',
			subtitle: 'Toshkent Siti skveri',
			note: 'Soyali qism, piyodalar kam.',
			atFraction: 0.8,
		},
	],
	walk: [
		{
			icon: Flame,
			tone: '#12B76A',
			title: 'Skver',
			subtitle: 'Soyali qism',
			note: 'Yo‘lning taxminan 40% qismi soyada o‘tadi.',
			atFraction: 0.35,
		},
		{
			icon: TriangleAlert,
			tone: '#F79009',
			title: 'O‘tish joyi',
			subtitle: 'Bunyodkor shoh ko‘chasi',
			note: 'Svetoforsiz o‘tish joyi — ehtiyot bo‘ling.',
			atFraction: 0.6,
		},
	],
}

export type DrivingTip = {
	title: string
	explain: string
	/** Static demo value/unit — ignored for "car", where the page computes a
	 * real distance-derived optimal-speed range instead. */
	demoValue: string
	demoUnit: string
}

export const DEMO_DRIVING_TIPS: Record<TransportMode, DrivingTip> = {
	car: {
		title: 'Optimal tezlik',
		explain: 'Shu tezlikni ushlab tursangiz, ko‘pchilik svetoforlardan to‘xtamay o‘tasiz.',
		demoValue: '',
		demoUnit: 'km/soat',
	},
	metro: {
		title: 'Tavsiya etilgan vagon',
		explain: 'Bu vagonlarda eng bo‘sh joy bor va o‘tish joyiga eng yaqin to‘xtaydi.',
		demoValue: '2–3',
		demoUnit: 'vagon',
	},
	scooter: {
		title: 'Zaryad yetadimi',
		explain: 'Marshrutga ≈38% zaryad kerak. Metroga qaytish uchun zaxira qoladi.',
		demoValue: '75',
		demoUnit: '% zaryad',
	},
	walk: {
		title: 'Chiqish uchun eng yaxshi vaqt',
		explain: 'Soat 13:00dan keyin harorat ko‘tariladi. Hozir yo‘lning 40% qismi soyada.',
		demoValue: '12:00',
		demoUnit: 'gacha',
	},
}

export type AlternativeRouteTemplate = {
	title: string
	distanceFactor: number
	timeFactor: number
	trafficLabel: string
	trafficTone: 'ok' | 'warn' | 'bad'
	note: string
	best?: boolean
}

// Distance/time are the real base distance/ETA multiplied by these factors,
// so numbers stay coherent no matter which real parking is the destination.
export const DEMO_ALTERNATIVE_ROUTES: Record<TransportMode, AlternativeRouteTemplate[]> = {
	car: [
		{
			title: 'Bunyodkor shoh ko‘chasi orqali',
			distanceFactor: 1.04,
			timeFactor: 1.09,
			trafficLabel: 'Tirbandlik o‘rtacha',
			trafficTone: 'warn',
			note: 'Tekis qoplama, svetoforlar kamroq',
		},
		{
			title: 'Nukusskaya ko‘chasi orqali',
			distanceFactor: 0.94,
			timeFactor: 0.86,
			trafficLabel: 'Tirbandlik past',
			trafficTone: 'ok',
			note: '3 daqiqa tezroq, 2 ta kamera bor',
			best: true,
		},
		{
			title: 'Shota Rustaveli ko‘chasi orqali',
			distanceFactor: 1.13,
			timeFactor: 1.18,
			trafficLabel: 'Tirbandlik yuqori',
			trafficTone: 'bad',
			note: 'Yo‘l ta’mirlanmoqda, aylanib o‘tish tavsiya etilmaydi',
		},
	],
	metro: [
		{
			title: 'Chilonzor → O‘zbekiston liniyasi',
			distanceFactor: 1,
			timeFactor: 1,
			trafficLabel: 'Bandlik 28%',
			trafficTone: 'ok',
			note: 'Bitta o‘tish, qisqa yo‘lak',
			best: true,
		},
		{
			title: 'Yunusobod → Chilonzor liniyasi',
			distanceFactor: 1.1,
			timeFactor: 1.28,
			trafficLabel: 'Bandlik 60%',
			trafficTone: 'warn',
			note: 'Ikkita o‘tish, lekin piyoda qism qisqaroq',
		},
	],
	scooter: [
		{
			title: 'Velodoʻrajkalar bo‘ylab',
			distanceFactor: 1,
			timeFactor: 1,
			trafficLabel: '90% ajratilgan polosada',
			trafficTone: 'ok',
			note: 'Xavfsizroq, qoplama tekis',
			best: true,
		},
		{
			title: 'To‘g‘ridan-to‘g‘ri yo‘llar bo‘ylab',
			distanceFactor: 0.85,
			timeFactor: 0.8,
			trafficLabel: 'Harakat zich',
			trafficTone: 'bad',
			note: 'Tezroq, lekin 3 ta xavfli kesishma bor',
		},
	],
	walk: [
		{
			title: 'Toshkent Siti skveri orqali',
			distanceFactor: 1,
			timeFactor: 1,
			trafficLabel: '40% soyada',
			trafficTone: 'ok',
			note: 'Issiqda qulayroq',
			best: true,
		},
		{
			title: 'Shoh ko‘cha bo‘ylab to‘g‘ri',
			distanceFactor: 0.89,
			timeFactor: 0.91,
			trafficLabel: 'Soya deyarli yo‘q',
			trafficTone: 'warn',
			note: 'Qisqaroq, lekin issiq va shovqinli',
		},
	],
}

export type DemoBus = {
	number: string
	route: string
	arrivalMin: number
	stops: number
	occupancyPct: number
	seated: number
	standing: number
	passengers: number
	recommended?: boolean
}

export const DEMO_BUSES: DemoBus[] = [
	{
		number: '№72',
		route: 'Buyuk Ipak Yo‘li → Mustaqillik',
		arrivalMin: 4,
		stops: 6,
		occupancyPct: 85,
		seated: 2,
		standing: 15,
		passengers: 58,
	},
	{
		number: '№81',
		route: 'Mustaqillik → manzil',
		arrivalMin: 6,
		stops: 4,
		occupancyPct: 35,
		seated: 18,
		standing: 20,
		passengers: 22,
		recommended: true,
	},
	{
		number: '№45',
		route: 'Buyuk Ipak Yo‘li → manzil',
		arrivalMin: 9,
		stops: 9,
		occupancyPct: 65,
		seated: 6,
		standing: 25,
		passengers: 41,
	},
]

export type DemoMetroLine = {
	name: string
	arrivalMin: number
	occupancyPct: number
	color: string
	recommendedCar: number
	// Occupancy per carriage, front to back. City Goo draws this row so you
	// know which door to stand at, which is the whole point of the section.
	cars: number[]
}

export const DEMO_METRO_LINES: DemoMetroLine[] = [
	{
		name: 'Chilonzor liniyasi',
		arrivalMin: 2,
		occupancyPct: 28,
		color: '#12B76A',
		recommendedCar: 2,
		cars: [42, 18, 22, 35],
	},
	{
		name: 'O‘zbekiston liniyasi',
		arrivalMin: 5,
		occupancyPct: 45,
		color: '#2E90FA',
		recommendedCar: 1,
		cars: [22, 38, 55, 48],
	},
	{
		name: 'Yunusobod liniyasi',
		arrivalMin: 6,
		occupancyPct: 60,
		color: '#7C3AED',
		recommendedCar: 1,
		cars: [30, 52, 68, 74],
	},
]

export type DemoMicroOption = {
	icon: LucideIcon
	title: string
	subtitle: string
	badge: string
	note: string
}

export const DEMO_MICRO_OPTIONS: DemoMicroOption[] = [
	{
		icon: Bike,
		title: 'Elektro skuter',
		subtitle: 'Eng yaqin punkt — 60 metr',
		badge: 'Zaryad 75%',
		note: 'Manzilda 12 ta bo‘sh joy',
	},
	{
		icon: Bike,
		title: 'Velosiped',
		subtitle: 'Ijara punkti — 140 metr',
		badge: '70% velo-yo‘lakda',
		note: 'Manzilda 8 ta bo‘sh joy',
	},
	{
		icon: Footprints,
		title: 'Piyoda',
		subtitle: 'Qo‘shimcha ijaraga hojat yo‘q',
		badge: 'Yo‘lak yaxshi holatda',
		note: 'Yo‘lning 40% qismi soyada',
	},
]

export type CurrentSituationRow = {
	icon: LucideIcon
	label: string
	value: string
	tone: 'ok' | 'warn' | 'bad'
	detail: string
}

// Weather is intentionally not here — the page reads the real, shared
// CITY_META snapshot for the destination's city instead of a second copy.
export const DEMO_CURRENT_SITUATION: CurrentSituationRow[] = [
	{
		icon: TriangleAlert,
		label: 'Shahardagi tirbandlik',
		value: 'Yuqori',
		tone: 'bad',
		detail: 'Markazda o‘rtacha tezlik ≈21 km/soat. Cho‘qqi soat 19:30gacha.',
	},
	{
		icon: Camera,
		label: 'Yo‘l-transport hodisalari',
		value: '3',
		tone: 'bad',
		detail: 'Shulardan bittasi sizning marshrutingiz yaqinida qayd etilgan.',
	},
	{
		icon: Construction,
		label: 'Yo‘l ta’mirlash',
		value: '7 uchastka',
		tone: 'warn',
		detail: 'Bitta uchastka marshrutingizda — Bunyodkor shoh ko‘chasi, 30 mayga qadar.',
	},
	{
		icon: Ban,
		label: 'Yopiq yo‘llar',
		value: '2',
		tone: 'warn',
		detail: 'Mustaqillik maydoni 14:00gacha yopiq, ikkinchisi shahar tadbiri tufayli.',
	},
]

export const DEMO_ROADWORKS_NOTICE = {
	title: 'Yo‘l ishlari',
	message: 'Bunyodkor shoh ko‘chasi — bir qatorga toraytirilgan, aylanib o‘tish tavsiya etiladi.',
}

export type DemoDestination = {
	id: string
	icon: LucideIcon
	title: string
	// Street address exactly as City Goo's address book spells it. Left out
	// for the driver's own position, whose subtitle is the live location
	// status the page already computes.
	address?: string
	// Which real parking from src/data/parkings.ts a route to this place
	// targets. B SPACE has no place database or geocoder, so the link is
	// declared here instead of derived from coordinates. Without one the
	// page keeps its existing behaviour and routes to the closest parking.
	parkingId?: string
	point?: { lat: number; lng: number }
}

// Public destinations for the /transport picker. Place names and street
// addresses are kept verbatim — B SPACE has no address catalog of its own
// and translating them would invent data. None of this is mixed into
// PARKINGS: each entry only points at a real parking that already exists
// there, so picking one moves real transport state (distance, ETA, map,
// route summary, availability) rather than text.
//
// City Goo's ADDR_BOOK also opened with «Uy» and «Ish» at fixed street
// addresses. Those were this customer's saved places, and this customer has
// saved none, so they are gone; every row left is a public landmark or the
// driver's own live position.
export const DEMO_DESTINATIONS: DemoDestination[] = [
	{
		id: 'me',
		icon: LocateFixed,
		title: 'Mening joylashuvim',
	},
	{
		id: 'magic-city',
		icon: ShoppingBag,
		title: 'Magic City',
		address: 'ул. Амира Темура, 88',
		parkingId: 'magic-city',
	},
	{
		id: 'humo-arena',
		icon: Smile,
		title: 'Humo Arena',
		address: 'ул. Бабура, 40',
		parkingId: 'humo-arena',
	},
	{
		id: 'airport',
		icon: Navigation,
		title: 'Toshkent aeroporti',
		address: 'Toshkent xalqaro aeroporti',
		point: { lat: 41.2570, lng: 69.2810 },
	},
]
