import type { NewsItem } from '@/lib/types'

// Demo content. Streets are ones the rest of the app already names, and
// every road item lists the parkings it actually reaches so the feed can
// warn the parking screen rather than just being read.
export const NEWS: NewsItem[] = [
	{
		id: 'amir-temur-closure',
		category: 'road',
		severity: 'closure',
		title: 'Amir Temur ko‘chasida harakat yopiladi',
		summary: '25-may, 08:00–14:00 · Mustaqillikdan Sayilgohgacha',
		body: 'Shahar tadbiri sababli olti kvartal bo‘ylab harakat to‘liq yopiladi. Jamoat transporti Nukus ko‘chasi orqali aylanib o‘tadi. Ilova marshrutlarni avtomatik qayta quradi.',
		timeLabel: '09:12',
		affectedStreets: ['Amir Temur ko‘chasi', 'Sayilgoh ko‘chasi'],
		affectedParkingIds: ['amir-temur'],
		detourAdvice: 'Nukus ko‘chasi orqali aylanma yo‘l tavsiya etiladi.',
	},
	{
		id: 'bunyodkor-roadworks',
		category: 'road',
		severity: 'roadworks',
		title: 'Bunyodkor shoh ko‘chasida ta’mir',
		summary: 'Bir qatorgacha torayish, ishlar 30-maygacha',
		body: 'Uzunligi 1,2 km bo‘lgan uchastka. Tirbandlik soatlarida o‘rtacha kechikish — 8 daqiqa. Tavsiya etilgan aylanma: Shota Rustaveli ko‘chasi.',
		timeLabel: 'Kecha',
		affectedStreets: ['Bunyodkor shoh ko‘chasi'],
		affectedParkingIds: ['magic-city'],
		detourAdvice: 'Shota Rustaveli ko‘chasi orqali o‘ting.',
	},
	{
		id: 'chilonzor-incident',
		category: 'road',
		severity: 'incident',
		title: 'Chilonzorda yo‘l-transport hodisasi',
		summary: 'Bobur ko‘chasi, ikki qator band · xizmatlar ish olib bormoqda',
		body: 'Hodisa tufayli Bobur ko‘chasining ikki qatori vaqtincha yopilgan. Taxminiy tozalash vaqti — 40 daqiqa.',
		timeLabel: '2 soat oldin',
		affectedStreets: ['Bobur ko‘chasi'],
		affectedParkingIds: ['magic-city'],
		detourAdvice: 'Katta halqa yo‘l orqali aylanib o‘tish tezroq.',
	},
	{
		id: 'next-mall-parking',
		category: 'city',
		severity: 'info',
		title: 'Next Mall yonida yangi parking ochildi',
		summary: '120 ta joy, dastlabki ikki soat bepul',
		body: 'Ikki qavatli yopiq parking, elektromobillar uchun ikkita quvvatlash stansiyasi bilan. Bron qilish ilovada mavjud.',
		timeLabel: 'Kecha',
		affectedStreets: ['Shota Rustaveli ko‘chasi'],
		affectedParkingIds: ['next-mall'],
	},
	{
		id: 'metro-hours',
		category: 'city',
		severity: 'info',
		title: 'Metro ish vaqtini uzaytirmoqda',
		summary: 'Juma va shanba kunlari — 01:00 gacha',
		body: 'O‘zgarish uchala liniyaga ham tegishli. Yarim tundan keyingi interval — 12 daqiqa.',
		timeLabel: '23-may',
		affectedStreets: [],
		affectedParkingIds: [],
	},
]

export function getNewsItem(id: string) {
	return NEWS.find(item => item.id === id)
}

// Road items that name a given parking, so the parking screen can surface a
// warning for the lots actually on screen.
export function roadAlertsForParking(parkingId: string) {
	return NEWS.filter(
		item => item.category === 'road' && item.affectedParkingIds.includes(parkingId),
	)
}
