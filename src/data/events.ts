import type { CityEvent } from '@/lib/types'

// Demo content, lifted out of Home so Favorites and the news feed read the
// same list rather than each keeping a copy — the mistake the two place
// catalogs made.
export const EVENTS: CityEvent[] = [
	{
		id: 'concert',
		when: 'Bugun',
		time: '19:00',
		title: 'Konsert',
		place: 'Humo Arena',
		category: 'Musiqa',
		price: '150 000 so‘mdan',
		description:
			'Kechki konsert. Tadbir boshlanishidan oldin yaqin parkingni band qilish tavsiya etiladi.',
		accent: 'from-purple-900 via-violet-700 to-slate-950',
		parkingId: 'magic-city',
	},
	{
		id: 'fair',
		when: 'Ertaga',
		time: '10:00',
		title: 'Hunarmandlar yarmarkasi',
		place: 'Markaziy bog‘',
		category: 'Yarmarka',
		price: 'Kirish bepul',
		description:
			'Mahalliy hunarmandlar, taomlar va oilaviy dastur bilan shahar yarmarkasi.',
		accent: 'from-amber-900 via-orange-700 to-slate-950',
		parkingId: 'tashkent-city',
	},
	{
		id: 'cinema',
		when: 'Juma',
		time: '20:00',
		title: 'Ochiq osmon ostida kino',
		place: 'Magic City',
		category: 'Kino',
		price: '40 000 so‘m',
		description:
			'Ochiq maydondagi kechki kino seansi. Parking oldindan to‘lishi mumkin.',
		accent: 'from-sky-900 via-indigo-700 to-slate-950',
		parkingId: 'magic-city',
	},
	{
		id: 'run',
		when: 'Yakshanba',
		time: '09:00',
		title: 'Shahar yugurishi',
		place: 'Tashkent City',
		category: 'Sport',
		price: '50 000 so‘m',
		description:
			'5 va 10 km masofali shahar yugurishi. Ayrim ko‘chalar vaqtincha yopilishi mumkin.',
		accent: 'from-emerald-900 via-teal-700 to-slate-950',
		parkingId: 'tashkent-city',
	},
]

export function getEvent(id: string) {
	return EVENTS.find(event => event.id === id)
}
