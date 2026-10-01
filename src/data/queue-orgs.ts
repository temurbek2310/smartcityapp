import { getPlace } from '@/data/places'
import type { QueueOrg } from '@/lib/types'

// Demo content. Every organisation is a venue in the place catalog: it names
// its place and stores only what the queue itself knows — hours, the line,
// the desks. Title, address, position, rating, accent and parking come from
// the place, so the queue screen and the venue sheet can no longer disagree
// about where or what the venue is.
//
// hourlyLoad lines up with QUEUE_HOURS below — a 0 means the place is shut
// at that hour, which the chart draws as a flat stub rather than an empty
// queue.
export const QUEUE_HOURS = [
	'09:00',
	'11:00',
	'13:00',
	'15:00',
	'17:00',
	'19:00',
	'21:00',
	'23:00',
]

// What the queue knows, as opposed to what the venue is.
type QueueOrgRecord = Omit<
	QueueOrg,
	| 'title'
	| 'address'
	| 'lat'
	| 'lng'
	| 'distanceKm'
	| 'rating'
	| 'reviewCount'
	| 'accent'
	| 'parkingId'
>

const QUEUE_ORG_RECORDS: QueueOrgRecord[] = [
	{
		id: 'coffee-lab',
		placeId: 'coffee-lab',
		category: 'cafe',
		open: true,
		openTime: '08:00',
		closeTime: '23:00',
		waiting: 9,
		waitMinutes: 12,
		windows: 2,
		forecast: [
			{ inMinutes: 10, waitMinutes: 15, deltaLabel: '3 daq ko‘p', tone: 'warn' },
			{ inMinutes: 20, waitMinutes: 20, deltaLabel: '8 daq ko‘p', tone: 'bad' },
			{ inMinutes: 30, waitMinutes: 14, deltaLabel: '2 daq ko‘p', tone: 'warn' },
			{ inMinutes: 60, waitMinutes: 8, deltaLabel: '4 daq kam', tone: 'ok' },
		],
		hourlyLoad: [45, 62, 78, 90, 72, 55, 40, 25],
		// Eating in is a table booking, not a number: «Stolda buyurtma» and
		// «Stol navbati» both handed out a queue ticket for something the
		// customer had asked to reserve. The counter is the only real line
		// here, so it is the only service left.
		services: [
			{ id: 'takeaway', title: 'Olib ketish', avgWaitMinutes: 12, prefix: 'B', windows: 2, serviceMinutes: 5, bookable: false },
		],
		desks: [
			{ id: 'd1', number: 1, label: '1-kassa', kind: 'window', serviceIds: ['takeaway'] },
			{ id: 'd2', number: 2, label: '2-kassa', kind: 'window', serviceIds: ['takeaway'] },
		],
		tip: 'Tushlikda kassada navbat uzayadi — 13:00 dan oldin yoki 15:00 dan keyin tezroq.',
	},
	{
		id: 'ipoteka-bank',
		placeId: 'bank-office',
		category: 'bank',
		open: true,
		openTime: '09:00',
		closeTime: '18:00',
		waiting: 14,
		waitMinutes: 22,
		windows: 4,
		forecast: [
			{ inMinutes: 10, waitMinutes: 26, deltaLabel: '4 daq ko‘p', tone: 'warn' },
			{ inMinutes: 20, waitMinutes: 30, deltaLabel: '8 daq ko‘p', tone: 'bad' },
			{ inMinutes: 30, waitMinutes: 24, deltaLabel: '2 daq ko‘p', tone: 'warn' },
			{ inMinutes: 60, waitMinutes: 12, deltaLabel: '10 daq kam', tone: 'ok' },
		],
		hourlyLoad: [30, 55, 72, 68, 80, 45, 0, 0],
		services: [
			{ id: 'exchange', title: 'Valyuta ayirboshlash', avgWaitMinutes: 12, prefix: 'V', windows: 1, serviceMinutes: 10, bookable: true },
			{ id: 'account', title: 'Hisob ochish', avgWaitMinutes: 28, prefix: 'S', windows: 1, serviceMinutes: 30, bookable: true },
			{ id: 'credit', title: 'Kredit va bo‘lib to‘lash', avgWaitMinutes: 40, prefix: 'K', windows: 1, serviceMinutes: 40, bookable: true },
			{ id: 'cards', title: 'Karta va o‘tkazmalar', avgWaitMinutes: 18, prefix: 'C', windows: 1, serviceMinutes: 15, bookable: true },
		],
		desks: [
			{ id: 'd1', number: 1, label: '1-oyna', kind: 'window', serviceIds: ['exchange'] },
			{ id: 'd2', number: 2, label: '2-oyna', kind: 'window', serviceIds: ['account'] },
			{ id: 'd3', number: 3, label: '3-oyna', kind: 'window', serviceIds: ['credit'] },
			{ id: 'd4', number: 4, label: '4-oyna', kind: 'window', serviceIds: ['cards'] },
		],
		tip: '16:00 dan keyin navbat deyarli ikki barobar qisqaradi — valyuta amallarini kechroq qiling.',
	},
	{
		id: 'medical-plaza',
		placeId: 'medical-plaza',
		category: 'clinic',
		open: true,
		openTime: '08:00',
		closeTime: '20:00',
		waiting: 9,
		waitMinutes: 30,
		windows: 2,
		forecast: [
			{ inMinutes: 10, waitMinutes: 34, deltaLabel: '4 daq ko‘p', tone: 'warn' },
			{ inMinutes: 20, waitMinutes: 28, deltaLabel: '2 daq kam', tone: 'ok' },
			{ inMinutes: 30, waitMinutes: 20, deltaLabel: '10 daq kam', tone: 'ok' },
			{ inMinutes: 60, waitMinutes: 15, deltaLabel: '15 daq kam', tone: 'ok' },
		],
		hourlyLoad: [62, 75, 58, 40, 52, 35, 0, 0],
		services: [
			{ id: 'therapist', title: 'Terapevt qabuli', avgWaitMinutes: 30, prefix: 'T', windows: 1, serviceMinutes: 20, bookable: true },
			{ id: 'lab', title: 'Tahlil topshirish', avgWaitMinutes: 15, prefix: 'L', windows: 1, serviceMinutes: 10, bookable: true },
			{ id: 'mri', title: 'MRT va diagnostika', avgWaitMinutes: 45, prefix: 'M', windows: 1, serviceMinutes: 40, bookable: true },
		],
		desks: [
			{ id: 'd1', number: 1, label: 'Dr. Karimova', kind: 'specialist', role: 'Terapevt', serviceIds: ['therapist'] },
			{ id: 'd2', number: 2, label: 'Diagnostika xonasi', kind: 'desk', serviceIds: ['lab', 'mri'] },
		],
		tip: 'Tahlillarni ertalab 09:00 gacha topshirish eng tez — navbat 15 daqiqadan oshmaydi.',
	},
	{
		id: 'plov-center',
		placeId: 'plov-center',
		category: 'cafe',
		open: true,
		openTime: '09:00',
		closeTime: '22:00',
		waiting: 14,
		waitMinutes: 8,
		windows: 2,
		forecast: [
			{ inMinutes: 10, waitMinutes: 11, deltaLabel: '3 daq ko‘p', tone: 'warn' },
			{ inMinutes: 20, waitMinutes: 16, deltaLabel: '8 daq ko‘p', tone: 'bad' },
			{ inMinutes: 30, waitMinutes: 9, deltaLabel: '1 daq ko‘p', tone: 'ok' },
			{ inMinutes: 60, waitMinutes: 5, deltaLabel: '3 daq kam', tone: 'ok' },
		],
		hourlyLoad: [35, 70, 95, 60, 35, 28, 18, 0],
		// «Zalda ovqatlanish» was a queue ticket for a table — the same thing
		// «Stol band qilish» reserves properly. The counter is the only line.
		services: [
			{ id: 'takeaway', title: 'Olib ketish', avgWaitMinutes: 8, prefix: 'O', windows: 2, serviceMinutes: 5, bookable: false },
		],
		desks: [
			{ id: 'd1', number: 1, label: '1-kassa', kind: 'window', serviceIds: ['takeaway'] },
			{ id: 'd2', number: 2, label: '2-kassa', kind: 'window', serviceIds: ['takeaway'] },
		],
		tip: 'Osh tushlikda tugaydi — 13:00 dan oldin keling yoki kechki vaqtni tanlang.',
	},
	{
		id: 'davlat-xizmat',
		placeId: 'davlat-xizmat',
		category: 'gov',
		open: true,
		openTime: '09:00',
		closeTime: '18:00',
		waiting: 58,
		waitMinutes: 55,
		windows: 8,
		forecast: [
			{ inMinutes: 10, waitMinutes: 58, deltaLabel: '3 daq ko‘p', tone: 'bad' },
			{ inMinutes: 20, waitMinutes: 62, deltaLabel: '7 daq ko‘p', tone: 'bad' },
			{ inMinutes: 30, waitMinutes: 50, deltaLabel: '5 daq kam', tone: 'warn' },
			{ inMinutes: 60, waitMinutes: 30, deltaLabel: '25 daq kam', tone: 'ok' },
		],
		hourlyLoad: [88, 95, 82, 70, 55, 0, 0, 0],
		services: [
			{ id: 'passport', title: 'Pasport va ID karta', avgWaitMinutes: 55, prefix: 'P', windows: 3, serviceMinutes: 20, bookable: true },
			{ id: 'property', title: 'Kadastr va mulk', avgWaitMinutes: 40, prefix: 'K', windows: 2, serviceMinutes: 30, bookable: true },
			{ id: 'notary', title: 'Notarial xizmatlar', avgWaitMinutes: 25, prefix: 'N', windows: 2, serviceMinutes: 20, bookable: true },
			{ id: 'certificate', title: 'Ma’lumotnoma olish', avgWaitMinutes: 15, prefix: 'M', windows: 1, serviceMinutes: 10, bookable: true },
		],
		desks: [
			{ id: 'd1', number: 1, label: '1-oyna', kind: 'window', serviceIds: ['passport'] },
			{ id: 'd2', number: 2, label: '2-oyna', kind: 'window', serviceIds: ['passport'] },
			{ id: 'd3', number: 3, label: '3-oyna', kind: 'window', serviceIds: ['passport'] },
			{ id: 'd4', number: 4, label: '4-oyna', kind: 'window', serviceIds: ['property'] },
			{ id: 'd5', number: 5, label: '5-oyna', kind: 'window', serviceIds: ['property'] },
			{ id: 'd6', number: 6, label: '6-oyna', kind: 'window', serviceIds: ['notary'] },
			{ id: 'd7', number: 7, label: '7-oyna', kind: 'window', serviceIds: ['notary'] },
			{ id: 'd8', number: 8, label: '8-oyna', kind: 'window', serviceIds: ['certificate'] },
		],
		tip: 'Ertalabki navbat eng uzun. 15:00 dan keyin kutish vaqti yarmiga tushadi.',
	},
	{
		id: 'migratsiya',
		placeId: 'migratsiya',
		category: 'gov',
		open: true,
		openTime: '09:00',
		closeTime: '17:00',
		waiting: 33,
		waitMinutes: 48,
		windows: 4,
		forecast: [
			{ inMinutes: 10, waitMinutes: 52, deltaLabel: '4 daq ko‘p', tone: 'bad' },
			{ inMinutes: 20, waitMinutes: 45, deltaLabel: '3 daq kam', tone: 'warn' },
			{ inMinutes: 30, waitMinutes: 38, deltaLabel: '10 daq kam', tone: 'ok' },
			{ inMinutes: 60, waitMinutes: 25, deltaLabel: '23 daq kam', tone: 'ok' },
		],
		hourlyLoad: [80, 92, 75, 58, 30, 0, 0, 0],
		services: [
			{ id: 'registration', title: 'Ro‘yxatdan o‘tish', avgWaitMinutes: 48, prefix: 'R', windows: 2, serviceMinutes: 20, bookable: true },
			{ id: 'visa', title: 'Viza va ruxsatnoma', avgWaitMinutes: 35, prefix: 'V', windows: 1, serviceMinutes: 30, bookable: true },
			{ id: 'consult', title: 'Maslahat', avgWaitMinutes: 12, prefix: 'M', windows: 1, serviceMinutes: 15, bookable: true },
		],
		desks: [
			{ id: 'd1', number: 1, label: '1-oyna', kind: 'window', serviceIds: ['registration'] },
			{ id: 'd2', number: 2, label: '2-oyna', kind: 'window', serviceIds: ['registration'] },
			{ id: 'd3', number: 3, label: '3-oyna', kind: 'window', serviceIds: ['visa'] },
			{ id: 'd4', number: 4, label: '4-oyna', kind: 'window', serviceIds: ['consult'] },
		],
		tip: 'Juma kunlari navbat eng qisqa — imkon bo‘lsa shu kunga rejalashtiring.',
	},
	{
		id: 'avto-servis',
		placeId: 'cto-master',
		category: 'auto',
		open: true,
		openTime: '09:00',
		closeTime: '20:00',
		waiting: 6,
		waitMinutes: 18,
		windows: 3,
		forecast: [
			{ inMinutes: 10, waitMinutes: 20, deltaLabel: '2 daq ko‘p', tone: 'warn' },
			{ inMinutes: 20, waitMinutes: 16, deltaLabel: '2 daq kam', tone: 'ok' },
			{ inMinutes: 30, waitMinutes: 12, deltaLabel: '6 daq kam', tone: 'ok' },
			{ inMinutes: 60, waitMinutes: 10, deltaLabel: '8 daq kam', tone: 'ok' },
		],
		hourlyLoad: [40, 58, 65, 52, 48, 35, 20, 0],
		services: [
			{ id: 'diagnostics', title: 'Diagnostika', avgWaitMinutes: 18, prefix: 'D', windows: 1, serviceMinutes: 30, bookable: true },
			{ id: 'oil', title: 'Moy almashtirish', avgWaitMinutes: 25, prefix: 'Y', windows: 1, serviceMinutes: 30, bookable: true },
			{ id: 'tyres', title: 'Shinamontaj', avgWaitMinutes: 30, prefix: 'SH', windows: 1, serviceMinutes: 40, bookable: true },
		],
		desks: [
			{ id: 'd1', number: 1, label: '1-boks', kind: 'desk', serviceIds: ['diagnostics'] },
			{ id: 'd2', number: 2, label: '2-boks', kind: 'desk', serviceIds: ['oil'] },
			{ id: 'd3', number: 3, label: '3-boks', kind: 'desk', serviceIds: ['tyres'] },
		],
		tip: 'Shinamontaj mavsumida ertalab band bo‘ladi — tushdan keyin tezroq.',
	},
	{
		id: 'tuman-poliklinika',
		placeId: 'tuman-poliklinika',
		category: 'clinic',
		open: true,
		openTime: '08:00',
		closeTime: '19:00',
		waiting: 48,
		waitMinutes: 62,
		windows: 5,
		forecast: [
			{ inMinutes: 10, waitMinutes: 66, deltaLabel: '4 daq ko‘p', tone: 'bad' },
			{ inMinutes: 20, waitMinutes: 70, deltaLabel: '8 daq ko‘p', tone: 'bad' },
			{ inMinutes: 30, waitMinutes: 55, deltaLabel: '7 daq kam', tone: 'warn' },
			{ inMinutes: 60, waitMinutes: 35, deltaLabel: '27 daq kam', tone: 'ok' },
		],
		hourlyLoad: [95, 88, 62, 45, 38, 20, 0, 0],
		services: [
			{ id: 'family', title: 'Oilaviy shifokor qabuli', avgWaitMinutes: 62, prefix: 'O', windows: 2, serviceMinutes: 20, bookable: true },
			{ id: 'vaccine', title: 'Emlash (hamshira qabuli)', avgWaitMinutes: 20, prefix: 'E', windows: 1, serviceMinutes: 10, bookable: true },
			{ id: 'certificate', title: 'Tibbiy ma’lumotnoma', avgWaitMinutes: 30, prefix: 'T', windows: 2, serviceMinutes: 15, bookable: true },
		],
		desks: [
			{ id: 'd1', number: 1, label: 'Dr. Rahimov', kind: 'specialist', role: 'Oilaviy shifokor', serviceIds: ['family'] },
			{ id: 'd2', number: 2, label: 'Dr. Yusupova', kind: 'specialist', role: 'Oilaviy shifokor', serviceIds: ['family'] },
			{ id: 'd3', number: 3, label: 'Emlash xonasi', kind: 'desk', serviceIds: ['vaccine'] },
			{ id: 'd4', number: 4, label: '1-oyna', kind: 'window', serviceIds: ['certificate'] },
			{ id: 'd5', number: 5, label: '2-oyna', kind: 'window', serviceIds: ['certificate'] },
		],
		tip: 'Eng tinch vaqt — 17:00 dan keyin. Ertalabki navbat eng uzun bo‘ladi.',
	},
	{
		id: 'sitora-lab',
		placeId: 'sitora-lab',
		category: 'clinic',
		open: true,
		openTime: '07:30',
		closeTime: '18:00',
		waiting: 7,
		waitMinutes: 18,
		windows: 2,
		forecast: [
			{ inMinutes: 10, waitMinutes: 20, deltaLabel: '2 daq ko‘p', tone: 'warn' },
			{ inMinutes: 20, waitMinutes: 16, deltaLabel: '2 daq kam', tone: 'ok' },
			{ inMinutes: 30, waitMinutes: 12, deltaLabel: '6 daq kam', tone: 'ok' },
			{ inMinutes: 60, waitMinutes: 8, deltaLabel: '10 daq kam', tone: 'ok' },
		],
		hourlyLoad: [85, 70, 48, 35, 30, 0, 0, 0],
		services: [
			{ id: 'blood', title: 'Tahlil topshirish', avgWaitMinutes: 18, prefix: 'T', windows: 1, serviceMinutes: 10, bookable: true },
			{ id: 'results', title: 'Natijani olish', avgWaitMinutes: 6, prefix: 'N', windows: 1, serviceMinutes: 5, bookable: true },
		],
		desks: [
			{ id: 'd1', number: 1, label: 'Muolaja xonasi', kind: 'desk', serviceIds: ['blood'] },
			{ id: 'd2', number: 2, label: '1-oyna', kind: 'window', serviceIds: ['results'] },
		],
		tip: 'Tahlillar och qoringa topshiriladi — 09:00 gacha keling, keyin navbat kamayadi.',
	},
]

// Fails at load rather than rendering a desk with no venue: an organisation
// whose place is missing, or has no parking to offer, is a catalog bug.
function withPlace(record: QueueOrgRecord): QueueOrg {
	const place = getPlace(record.placeId)
	if (!place?.parkingId)
		throw new Error(`Queue org ${record.id} has no place with parking: ${record.placeId}`)
	return {
		...record,
		title: place.title,
		address: place.address,
		lat: place.lat,
		lng: place.lng,
		distanceKm: place.distanceKm,
		rating: place.rating,
		reviewCount: place.reviews,
		accent: place.accent,
		parkingId: place.parkingId,
	}
}

export const QUEUE_ORGS: QueueOrg[] = QUEUE_ORG_RECORDS.map(withPlace)

export function getQueueOrg(id: string) {
	return QUEUE_ORGS.find(org => org.id === id)
}

// The queue desk of a venue in the place catalog, when it has one. Places
// and desks are 1:1, so a venue has at most one line to show.
export function getQueueOrgByPlace(placeId: string) {
	return QUEUE_ORGS.find(org => org.placeId === placeId)
}

// The wait a venue shows, read from its live queue — never stored on the
// place. Naming a service gives that line's own wait (a café's counter);
// otherwise it is the desk's overall wait. A venue with no queue desk has
// no wait at all: undefined, and the UI shows none.
export function placeQueueWaitMinutes(placeId: string, serviceId?: string) {
	const org = getQueueOrgByPlace(placeId)
	if (!org) return undefined
	const service = serviceId ? getQueueService(org, serviceId) : undefined
	return service?.avgWaitMinutes ?? org.waitMinutes
}

// How loaded the place is right now, as a percentage. City Goo derives this
// from people-per-window rather than storing it, so it stays consistent with
// the waiting count the card already shows.
export function queueLoadPercent(org: QueueOrg) {
	if (!org.windows) return 0
	return Math.min(99, Math.round((org.waiting / (org.windows * 12)) * 100))
}

export function getQueueService(org: QueueOrg, serviceId: string) {
	return org.services.find(service => service.id === serviceId)
}

// The windows, desks and specialists that serve one line, in their printed
// order. A desk shared by two lines appears under both.
export function desksForService(org: QueueOrg, serviceId: string) {
	return org.desks
		.filter(desk => desk.serviceIds.includes(serviceId))
		.sort((a, b) => a.number - b.number)
}

export function getQueueDesk(org: QueueOrg, deskId: string | undefined) {
	if (!deskId) return undefined
	return org.desks.find(desk => desk.id === deskId)
}
