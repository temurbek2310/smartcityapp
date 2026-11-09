'use client'

import {
	BellRing,
	CarFront,
	ChevronRight,
	Clock3,
	CreditCard,
	Crown,
	Download,
	Gift,
	HelpCircle,
	Languages,
	LogOut,
	RotateCcw,
	ShieldCheck,
	Sparkles,
	Trash2,
	Wallet,
	type LucideIcon,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'

import { AiCallout } from '@/components/ui/ai-callout'
import { Badge } from '@/components/ui/badge'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { IconTile } from '@/components/ui/icon-tile'
import { KeyValue, KeyValueList } from '@/components/ui/key-value'
import { Meter } from '@/components/ui/meter'
import { SectionHeader } from '@/components/ui/section-header'
import { Switch } from '@/components/ui/switch'
import { Toast } from '@/components/ui/toast'
import { useApp } from '@/context/app-context'
import { getParking } from '@/data/parkings'
import { PAYMENT_METHODS, PREMIUM_PERKS, PREMIUM_PRICE_UZS } from '@/data/profile'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/cn'
import { resetDemoData } from '@/lib/account-exit'
import { MAIN_STATE_KEY } from '@/lib/account-storage'
import { liveBookingCount } from '@/lib/booking-lifecycle'
import { formatDate, formatUZS } from '@/lib/format'
import { displayUzbekPlate, formatUzbekPlate, normalizeUzbekPlate } from '@/lib/plate'
import { tashkentHour } from '@/lib/tashkent-time'
import type { NotificationPrefId } from '@/lib/types'

const NOTIFICATION_ROWS: { id: NotificationPrefId; label: string }[] = [
	{ id: 'bookingReminders', label: 'Bronlar va eslatmalar' },
	{ id: 'freeSpaces', label: 'Bo‘sh joylar' },
	{ id: 'queueTurn', label: 'Navbat yaqinlashganda' },
	{ id: 'roadClosures', label: 'Yo‘l yopilishi va ta’mir' },
	{ id: 'cityEvents', label: 'Shahar voqealari' },
	{ id: 'partnerOffers', label: 'Hamkor takliflari' },
]

type SheetKind =
	| 'premium'
	| 'stats'
	| 'plate'
	| 'payments'
	| 'notifications'
	| 'language'
	| 'support'
	| 'privacy'
	| 'edit'
	| 'delete'
	| 'logout'
	// Only ever the blocked sheet: an allowed demo reset runs straight away.
	| 'reset'

export default function ProfilePage() {
	const router = useRouter()
	const toast = useToast<string>()
	const app = useApp()
	const {
		user,
		reservations,
		favorites,
		queueTickets,
		serviceBookings,
		updateProfile,
		setNotificationPref,
		notificationPrefs,
		logout,
		deleteAccount,
		resetDemo,
	} = app

	const [sheet, setSheet] = useState<SheetKind | null>(null)
	// Logout and account deletion are both refused while any of these is live
	// — see lib/account-exit.
	const liveBookings = liveBookingCount({ reservations, queueTickets, serviceBookings })
	const [payments, setPayments] = useState(PAYMENT_METHODS)
	// Seeded from the customer's own plate, never from a sample one.
	const [plateDraft, setPlateDraft] = useState('')

	function openPlateSheet() {
		setPlateDraft(formatUzbekPlate(user?.vehiclePlate ?? ''))
		setSheet('plate')
	}

	// Everything here is computed from what the user actually did. City Goo
	// hardcodes its statistics; inventing "128 trips" in a demo someone will
	// click through is worse than showing a small honest number.
	const stats = useMemo(() => {
		const completed = reservations.filter(item => item.status === 'completed')
		const hours = reservations.reduce(
			(total, item) => total + item.durationHours,
			0,
		)
		const spent = completed.reduce(
			(total, item) => total + (item.finalTotal ?? item.estimatedTotal),
			0,
		)
		return {
			bookings: reservations.length,
			hours,
			spent,
			saved: favorites.length,
		}
	}, [reservations, favorites])

	// Which lots this person actually uses, for the stats breakdown.
	const byParking = useMemo(() => {
		const counts = new Map<string, number>()
		for (const reservation of reservations) {
			counts.set(
				reservation.parkingId,
				(counts.get(reservation.parkingId) ?? 0) + 1,
			)
		}
		const total = reservations.length || 1
		return [...counts.entries()]
			.map(([id, count]) => ({
				name: getParking(id)?.name ?? id,
				percent: Math.round((count / total) * 100),
			}))
			.sort((a, b) => b.percent - a.percent)
			.slice(0, 4)
	}, [reservations])

	// The hour this person books most, derived from their own reservations.
	const busiestHour = useMemo(() => {
		if (!reservations.length) return null
		const hours = new Map<number, number>()
		for (const reservation of reservations) {
			// On Tashkent's clock, like every booking time — not the device's.
			const hour = tashkentHour(reservation.startAt)
			hours.set(hour, (hours.get(hour) ?? 0) + 1)
		}
		const [hour] = [...hours.entries()].sort((a, b) => b[1] - a[1])[0]
		return hour
	}, [reservations])

	if (!user) return null

	const premium = Boolean(user.premium)

	return (
		<div className='space-y-5'>
			<h1 className='text-[22px] font-black tracking-[-0.02em] text-ink'>
				Profil
			</h1>

			<Card>
				<div className='flex items-center gap-3'>
					<span className='grid size-13 shrink-0 place-items-center rounded-2xl bg-brand-50 text-[20px] font-black text-brand'>
						{user.name.slice(0, 1).toUpperCase()}
					</span>
					<div className='min-w-0 flex-1'>
						<p className='truncate text-[17px] font-black text-ink'>
							{user.name}
						</p>
						<p className='mt-0.5 text-[11.5px] text-ink-3'>{user.phone}</p>
						{user.joinedAt && (
							<p className='mt-0.5 text-[11.5px] text-ink-3'>
								Bizda {formatDate(user.joinedAt)} dan beri
							</p>
						)}
					</div>
					{premium && (
						<Badge tone='brand'>
							<Crown className='size-3' /> Premium
						</Badge>
					)}
					<button
						type='button'
						aria-label='Profilni ko‘rish'
						onClick={() => setSheet('edit')}
						className='grid size-9 shrink-0 place-items-center rounded-xl bg-card-2 text-ink-3'
					>
						<ChevronRight className='size-4' />
					</button>
				</div>
			</Card>

			{!premium && (
				<button
					type='button'
					onClick={() => setSheet('premium')}
					className='w-full rounded-card-lg bg-linear-[135deg,#6c47e0,#4a2fa8] p-4 text-left'
				>
					<div className='flex items-center justify-between'>
						<span className='rounded-[7px] bg-white/20 px-2 py-1 text-[10.5px] font-extrabold text-white'>
							SmartCity Premium
						</span>
						<ChevronRight className='size-4 text-white' />
					</div>
					<p className='mt-2.5 text-[16px] font-black text-white'>
						Kafolat to‘lovisiz band qiling
					</p>
					<p className='mt-1.5 text-[12.5px] text-white/80'>
						Joy 30 daqiqa saqlanadi, navbatda ustunlik ·{' '}
						{formatUZS(PREMIUM_PRICE_UZS)}/oy
					</p>
				</button>
			)}

			<SectionHeader
				title='Statistika'
				action='Batafsil'
				onAction={() => setSheet('stats')}
			/>
			<Card>
				<div className='grid grid-cols-4 gap-2'>
					{[
						{ icon: CarFront, value: stats.bookings, label: 'bron' },
						{ icon: Clock3, value: `${stats.hours} s`, label: 'soat' },
						{ icon: Wallet, value: Math.round(stats.spent / 1000) + 'k', label: 'sarflandi' },
						{ icon: Sparkles, value: stats.saved, label: 'sevimli' },
					].map(stat => (
						<div
							key={stat.label}
							className='rounded-xl bg-card-2 px-1 py-3 text-center'
						>
							<stat.icon className='mx-auto size-4 text-brand' />
							<p className='mt-1.5 text-[15px] font-black text-ink'>
								{stat.value}
							</p>
							<p className='mt-0.5 text-[10px] text-ink-3'>{stat.label}</p>
						</div>
					))}
				</div>
			</Card>

			<SectionHeader title='Hisob' />
			<Card variant='bare'>
				<Row
					icon={CarFront}
					label='Avtomobil'
					value={displayUzbekPlate(user.vehiclePlate)}
					onClick={openPlateSheet}
				/>
				<Row
					icon={CreditCard}
					label='To‘lov usullari'
					value={`${payments.length} ta karta`}
					onClick={() => setSheet('payments')}
					divided
				/>
				<Row
					icon={BellRing}
					label='Bildirishnomalar'
					value={`${Object.values(notificationPrefs).filter(Boolean).length} ta yoqilgan`}
					onClick={() => setSheet('notifications')}
					divided
				/>
				<Row
					icon={Languages}
					label='Til'
					value='O‘zbekcha'
					onClick={() => setSheet('language')}
					divided
				/>
			</Card>

			<SectionHeader title='Yana' />
			<Card variant='bare'>
				<Row
					icon={HelpCircle}
					label='Yordam va qo‘llab-quvvatlash'
					onClick={() => setSheet('support')}
				/>
				<Row
					icon={Gift}
					label='Do‘stni taklif qilish'
					onClick={async () => {
						try {
							await navigator.clipboard.writeText('https://smartcity.uz/invite')
							toast.show('Taklif havolasi nusxalandi')
						} catch {
							toast.show('Taklif havolasi: smartcity.uz/invite')
						}
					}}
					divided
				/>
				<Row
					icon={ShieldCheck}
					label='Maxfiylik va ma’lumotlar'
					onClick={() => setSheet('privacy')}
					divided
				/>
				<Row
					icon={LogOut}
					label='Chiqish'
					danger
					onClick={() => setSheet('logout')}
					divided
				/>
			</Card>

			<Card variant='flat'>
				<p className='text-[11.5px] leading-5 text-ink-3'>
					OTP, shlagbaum skaneri, real vaqtdagi bandlik va to‘lov provayderi
					demo rejimida ishlaydi — loyiha tashqi kalitlarsiz ishga tushadi.
				</p>
			</Card>

			<button
				type='button'
				onClick={() => {
					if (!resetDemoData(app).ok) {
						setSheet('reset')
						return
					}
					resetDemo()
					router.replace('/welcome')
				}}
				className='flex h-11 w-full items-center justify-center gap-2 text-[12.5px] font-bold text-bad'
			>
				<RotateCcw className='size-4' /> Demo ma’lumotlarini tozalash
			</button>

			<p className='pb-2 text-center text-[11px] text-ink-3'>
				SmartCity · demo 1.0 · Toshkent
			</p>

			{sheet === 'premium' && (
				<BottomSheet title='SmartCity Premium' onClose={() => setSheet(null)}>
					<div className='rounded-card-lg bg-linear-[135deg,#6c47e0,#4a2fa8] p-4'>
						<p className='text-[22px] font-black text-white'>
							{formatUZS(PREMIUM_PRICE_UZS)}
						</p>
						<p className='mt-1 text-[12.5px] text-white/80'>
							oyiga · istalgan vaqtda bekor qilish
						</p>
					</div>

					<div className='mt-3 space-y-2'>
						{PREMIUM_PERKS.map(perk => (
							<Card key={perk.title} className='flex items-start gap-3'>
								<IconTile tone='bg-brand-50 text-brand'>
									<Crown className='size-[18px]' />
								</IconTile>
								<div className='min-w-0 flex-1'>
									<p className='text-[14px] font-bold text-ink'>{perk.title}</p>
									<p className='mt-0.5 text-[11.5px] text-ink-3'>
										{perk.description}
									</p>
								</div>
							</Card>
						))}
					</div>

					<Button
						variant='primary'
						block
						className='mt-4'
						onClick={() => {
							updateProfile({ premium: true })
							setSheet(null)
							toast.show('Premium 7 kun bepul ulandi')
						}}
					>
						Premiumni ulash
					</Button>
					<p className='mt-2 text-center text-[11px] text-ink-3'>
						Birinchi 7 kun bepul
					</p>
				</BottomSheet>
			)}

			{sheet === 'stats' && (
				<BottomSheet title='Sizning statistikangiz' onClose={() => setSheet(null)}>
					<Card>
						<KeyValueList>
							<KeyValue label='Jami bronlar' value={stats.bookings} />
							<KeyValue label='Jami soat' value={`${stats.hours} soat`} />
							<KeyValue label='Sarflangan' value={formatUZS(stats.spent)} />
							<KeyValue label='Navbat talonlari' value={queueTickets.length} />
						</KeyValueList>
					</Card>

					{byParking.length > 0 && (
						<Card className='mt-3'>
							<p className='text-[14px] font-bold text-ink'>
								Qaysi parkinglardan foydalanasiz
							</p>
							<div className='mt-3 space-y-2.5'>
								{byParking.map(item => (
									<div key={item.name}>
										<div className='flex items-center justify-between text-[11.5px]'>
											<span className='truncate text-ink-2'>{item.name}</span>
											<b className='text-ink'>{item.percent}%</b>
										</div>
										<Meter value={item.percent} className='mt-1' height={5} />
									</div>
								))}
							</div>
						</Card>
					)}

					<AiCallout className='mt-3' title='AI kuzatuvi'>
						{busiestHour === null
							? 'Hali yetarli ma’lumot yo‘q — bir nechta parking band qilganingizdan keyin odatlaringizni tahlil qilamiz.'
							: `Siz ko‘pincha ${String(busiestHour).padStart(2, '0')}:00 atrofida band qilasiz. Shu payt markazdagi parkinglar tezroq to‘ladi — kechqurundan band qilib qo‘ying.`}
					</AiCallout>
				</BottomSheet>
			)}

			{sheet === 'plate' && (
				<BottomSheet title='Avtomobil' onClose={() => setSheet(null)}>
					<Card className='text-center'>
						<p className='font-mono text-3xl font-black text-ink'>
							{displayUzbekPlate(user.vehiclePlate)}
						</p>
						<p className='mt-2 text-[12px] text-ink-3'>
							Raqam faqat siz band qilgan joyga, faqat bron vaqtiga uzatiladi
						</p>
					</Card>

					{/* Three fixed plates used to sit here as if they were the
					    customer's other vehicles. They belonged to nobody, and they
					    were also the only way to change a plate after signing up —
					    so they are replaced by the field that should have been here,
					    formatted by the same helper the sign-up form uses. */}
					<Card className='mt-3'>
						<label
							htmlFor='plate-input'
							className='text-[11px] font-bold uppercase tracking-[.16em] text-ink-3'
						>
							Yangi raqam
						</label>
						<input
							id='plate-input'
							value={plateDraft}
							onChange={event =>
								setPlateDraft(formatUzbekPlate(event.target.value))
							}
							inputMode='text'
							autoComplete='off'
							placeholder='01 A 777 AA'
							className='mt-2 h-12 w-full rounded-xl border border-line-2 bg-white px-3 text-center font-mono text-[18px] font-black uppercase tracking-wide text-ink placeholder:font-normal placeholder:tracking-normal placeholder:text-ink-3'
						/>
						<Button
							variant='primary'
							block
							className='mt-3'
							disabled={normalizeUzbekPlate(plateDraft).length < 5}
							onClick={() => {
								updateProfile({ vehiclePlate: formatUzbekPlate(plateDraft) })
								setSheet(null)
								toast.show('Avtomobil raqami yangilandi')
							}}
						>
							Saqlash
						</Button>
					</Card>
				</BottomSheet>
			)}

			{sheet === 'payments' && (
				<BottomSheet title='To‘lov usullari' onClose={() => setSheet(null)}>
					<div className='space-y-2'>
						{payments.map(method => (
							<button
								key={method.id}
								type='button'
								onClick={() => {
									setPayments(current =>
										current.map(item => ({
											...item,
											primary: item.id === method.id,
										})),
									)
									toast.show('Asosiy karta o‘zgartirildi')
								}}
								className='flex w-full items-center gap-3 rounded-card-lg bg-card p-3 text-left shadow-card'
							>
								<IconTile tone='bg-card-2 text-brand'>
									<CreditCard className='size-[18px]' />
								</IconTile>
								<span className='min-w-0 flex-1'>
									<span className='block text-[14px] font-semibold text-ink'>
										{method.title}
									</span>
									<span className='mt-0.5 block font-mono text-[11px] text-ink-3'>
										{method.masked}
									</span>
								</span>
								{method.primary && <Badge tone='brand'>asosiy</Badge>}
							</button>
						))}
					</div>
					<Card variant='flat' className='mt-3'>
						<p className='text-[11.5px] leading-5 text-ink-3'>
							Demo rejim: hech qanday karta saqlanmaydi va hech qanday mablag‘
							yechilmaydi.
						</p>
					</Card>
				</BottomSheet>
			)}

			{sheet === 'notifications' && (
				<BottomSheet title='Bildirishnomalar' onClose={() => setSheet(null)}>
					<Card variant='bare'>
						{NOTIFICATION_ROWS.map((row, index) => (
							<div
								key={row.id}
								className={cn(
									'flex items-center justify-between gap-3 px-3.5 py-3',
									index > 0 && 'border-t border-line',
								)}
							>
								<span className='text-[14px] font-semibold text-ink'>
									{row.label}
								</span>
								<Switch
									label={row.label}
									checked={notificationPrefs[row.id]}
									onChange={value => setNotificationPref(row.id, value)}
								/>
							</div>
						))}
					</Card>
					<Card variant='flat' className='mt-3'>
						<p className='text-[11.5px] leading-5 text-ink-3'>
							“Bronlar va eslatmalar” o‘chirilsa, parking vaqti tugashidan
							oldingi 30 va 10 daqiqalik eslatmalar ham kelmaydi.
						</p>
					</Card>
				</BottomSheet>
			)}

			{sheet === 'language' && (
				<BottomSheet title='Til' onClose={() => setSheet(null)}>
					<Card>
						<p className='text-[14px] font-bold text-ink'>O‘zbekcha</p>
						<p className='mt-1 text-[12px] text-ink-3'>
							Hozircha ilova faqat o‘zbek tilida. Rus va ingliz tillari
							keyingi yangilanishlarda qo‘shiladi.
						</p>
					</Card>
				</BottomSheet>
			)}

			{sheet === 'support' && (
				<BottomSheet title='Yordam' onClose={() => setSheet(null)}>
					<div className='space-y-2'>
						{[
							'Parkingni qanday band qilaman?',
							'Joy bo‘lmasa nima qilaman?',
							'To‘lov qanday qaytariladi?',
							'Operator bilan bog‘lanish',
						].map(item => (
							<button
								key={item}
								type='button'
								onClick={() => {
									setSheet(null)
									toast.show('Operator 5 daqiqa ichida javob beradi')
								}}
								className='flex w-full items-center gap-3 rounded-card-lg bg-card p-3 text-left shadow-card'
							>
								<IconTile tone='bg-card-2 text-brand'>
									<HelpCircle className='size-[18px]' />
								</IconTile>
								<span className='flex-1 text-[14px] font-semibold text-ink'>
									{item}
								</span>
								<ChevronRight className='size-4 text-ink-3' />
							</button>
						))}
					</div>
				</BottomSheet>
			)}

			{sheet === 'privacy' && (
				<BottomSheet title='Maxfiylik va ma’lumotlar' onClose={() => setSheet(null)}>
					<Card>
						<p className='text-[13px] leading-5 text-ink-2'>
							Biz saqlaymiz: ism, telefon, avtomobil raqami, bronlar tarixi va
							marshrut qurishdagi joylashuv. Avtomobil raqami faqat siz bron
							qilgan joyga va faqat bron vaqtiga uzatiladi.
						</p>
					</Card>

					{/* A real export, not a toast: the whole state blob is what we
					    actually hold, so handing it over is the honest version of
					    this control. */}
					<Button
						variant='outline'
						block
						className='mt-3'
						onClick={() => {
							const blob = new Blob(
								[localStorage.getItem(MAIN_STATE_KEY) ?? '{}'],
								{ type: 'application/json' },
							)
							const url = URL.createObjectURL(blob)
							const link = document.createElement('a')
							link.href = url
							link.download = 'smartcity-mening-malumotlarim.json'
							link.click()
							URL.revokeObjectURL(url)
							toast.show('Ma’lumotlaringiz yuklab olindi')
						}}
					>
						<Download className='size-4' /> Ma’lumotlarimni yuklab olish
					</Button>

					<Button
						variant='outline'
						danger
						block
						className='mt-2'
						onClick={() => setSheet('delete')}
					>
						<Trash2 className='size-4' /> Hisobni o‘chirish
					</Button>
				</BottomSheet>
			)}

			{sheet === 'edit' && (
				<BottomSheet title='Profil' onClose={() => setSheet(null)}>
					<Card>
						<KeyValueList>
							<KeyValue label='Ism' value={user.name} />
							<KeyValue label='Telefon' value={user.phone} />
							<KeyValue
								label='Avtomobil'
								value={displayUzbekPlate(user.vehiclePlate)}
							/>
							<KeyValue label='Til' value='O‘zbekcha' />
							{user.joinedAt && (
								<KeyValue
									label='Ro‘yxatdan o‘tgan'
									value={formatDate(user.joinedAt)}
								/>
							)}
						</KeyValueList>
					</Card>

					<Card variant='flat' className='mt-3'>
						<p className='text-[13px] leading-5 text-ink-2'>
							Ma’lumotlar faqat bronni tasdiqlash uchun ishlatiladi. Avtomobil
							raqami qo‘riqchi sizni kirishda tanishi uchun joyga uzatiladi.
						</p>
					</Card>

					<Button
						variant='outline'
						block
						className='mt-3'
						onClick={openPlateSheet}
					>
						<CarFront className='size-4 text-brand' /> Avtomobil raqamini
						o‘zgartirish
					</Button>
				</BottomSheet>
			)}

			{sheet === 'delete' && liveBookings === 0 && (
				<BottomSheet
					title='Hisobni o‘chirasizmi?'
					onClose={() => setSheet(null)}
				>
					<Card>
						<p className='text-[13px] leading-5 text-ink-2'>
							Bronlar, tarix va saqlangan joylar o‘chiriladi. Bu amalni
							ortga qaytarib bo‘lmaydi.
						</p>
					</Card>
					<div className='mt-4 grid grid-cols-2 gap-2'>
						<Button variant='outline' onClick={() => setSheet(null)}>
							Bekor qilish
						</Button>
						{/* A real deletion, not a toast: the whole local store is what
						    we actually hold, so clearing it is the honest version of
						    this control. */}
						<Button
							variant='primary'
							danger
							onClick={() => {
								try {
									// The store re-checks: a booking made since this sheet
									// rendered still blocks the deletion.
									if (deleteAccount()) router.replace('/welcome')
								} catch {
									toast.show('Ma’lumotlar to‘liq o‘chirilmadi. Brauzer saqlash sozlamalarini tekshiring.')
								}
							}}
						>
							O‘chirish
						</Button>
					</div>
				</BottomSheet>
			)}

			{(sheet === 'logout' || sheet === 'delete' || sheet === 'reset') && liveBookings > 0 && (
				<BottomSheet title='Faol bron mavjud' onClose={() => setSheet(null)}>
					<Card>
						<p className='text-[13px] leading-5 text-ink-2'>
							{sheet === 'delete'
								? 'Hisobni o‘chirishdan oldin faol bron yoki navbatni yakunlang yoki bekor qiling.'
								: sheet === 'reset'
									? 'Demo ma’lumotlarini tozalashdan oldin faol bron yoki navbatni yakunlang yoki bekor qiling.'
									: 'Hisobdan chiqishdan oldin faol bron yoki navbatni yakunlang yoki bekor qiling.'}
						</p>
						<p className='mt-2 text-[12px] font-semibold text-ink-3'>
							Faol: {liveBookings} ta
						</p>
					</Card>
					<div className='mt-4 grid grid-cols-2 gap-2'>
						<Button variant='outline' onClick={() => setSheet(null)}>
							Qolish
						</Button>
						<Button
							variant='primary'
							onClick={() => {
								setSheet(null)
								router.push('/bookings')
							}}
						>
							Bronlarni ko‘rish
						</Button>
					</div>
				</BottomSheet>
			)}

			{sheet === 'logout' && liveBookings === 0 && (
				<BottomSheet title='Hisobdan chiqish' onClose={() => setSheet(null)}>
					<Card>
						<p className='text-[13px] leading-5 text-ink-2'>
							Hisobdan chiqsangiz, ushbu qurilmadagi bronlar tarixi,
							sevimlilar, bildirishnomalar va saqlangan marshrutlar tozalanadi.
						</p>
					</Card>
					<div className='mt-4 grid grid-cols-2 gap-2'>
						<Button variant='outline' onClick={() => setSheet(null)}>
							Bekor qilish
						</Button>
						<Button
							variant='primary'
							onClick={() => {
								// The store has the last word: a booking made since this
								// sheet rendered still keeps the customer signed in.
								if (logout()) router.replace('/welcome')
							}}
						>
							Hisobdan chiqish
						</Button>
					</div>
				</BottomSheet>
			)}

			<Toast open={toast.open} message={toast.payload ?? ''} />
		</div>
	)
}

function Row({
	icon: Icon,
	label,
	value,
	onClick,
	divided = false,
	danger = false,
}: {
	icon: LucideIcon
	label: string
	value?: string
	onClick: () => void
	divided?: boolean
	danger?: boolean
}) {
	return (
		<button
			type='button'
			onClick={onClick}
			className={cn(
				'flex w-full items-center gap-3 px-3.5 py-3 text-left',
				divided && 'border-t border-line',
			)}
		>
			<IconTile tone={danger ? 'bg-bad-bg text-bad' : 'bg-card-2 text-brand'}>
				<Icon className='size-[18px]' />
			</IconTile>
			<span className='min-w-0 flex-1'>
				<span
					className={cn(
						'block text-[14px] font-semibold',
						danger ? 'text-bad' : 'text-ink',
					)}
				>
					{label}
				</span>
				{value && (
					<span className='mt-0.5 block truncate text-[11px] text-ink-3'>
						{value}
					</span>
				)}
			</span>
			<ChevronRight className='size-4 shrink-0 text-ink-3' />
		</button>
	)
}
