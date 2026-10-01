import type { PaymentMethod, PremiumPerk } from '@/lib/types'

// Demo content. Cards are the providers Uzbek drivers actually use; nothing
// is charged and no card details exist beyond these masked strings.
export const PAYMENT_METHODS: PaymentMethod[] = [
	{ id: 'click', title: 'Click', masked: '•••• 4417', primary: true },
	{ id: 'payme', title: 'Payme', masked: '•••• 8802', primary: false },
	{ id: 'uzum', title: 'Uzum Bank', masked: '•••• 1290', primary: false },
]

export const PREMIUM_PRICE_UZS = 39000

export const PREMIUM_PERKS: PremiumPerk[] = [
	{
		title: 'Kafolat to‘lovisiz band qilish',
		description: 'Band qilishda kafolat summasi ushlab qolinmaydi.',
	},
	{
		title: 'Joy 30 daqiqa saqlanadi',
		description: 'Odatdagi 15 daqiqa o‘rniga ikki barobar ko‘p vaqt.',
	},
	{
		title: 'Navbatda ustunlik',
		description: 'Talon ikki pozitsiya yuqoriroq beriladi.',
	},
	{
		title: 'Reklamasiz marshrutlar',
		description: 'Va Toshkentning oflayn xaritasi.',
	},
	{
		title: 'Aqlli eslatmalar',
		description: 'Qachon yo‘lga chiqish kerakligini AI aytadi.',
	},
]
