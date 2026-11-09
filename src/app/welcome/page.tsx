'use client'

import { LoadingScreen } from '@/components/ui/loading-screen'
import { useApp } from '@/context/app-context'
import {
	formatUzbekPlate,
	normalizeUzbekPlate,
} from '@/lib/plate'
import {
	CarFront,
	Check,
	MapPinned,
	QrCode,
	ShieldCheck,
	Smartphone,
} from 'lucide-react'
import { resolveNextPath } from '@/lib/safe-next'
import { SmartCityLogo } from '@/components/ui/smartcity-logo'
import { useRouter, useSearchParams } from 'next/navigation'
import {
	Suspense,
	useEffect,
	useMemo,
	useRef,
	useState,
	type ChangeEvent,
} from 'react'
import { z } from 'zod'

const profileSchema = z.object({
	name: z.string().trim().min(2, 'Ismni kiriting'),
	phone: z.string().regex(/^\+998\d{9}$/, '+998 bilan 9 ta raqam kiriting'),
	vehiclePlate: z.string().trim().min(5, 'Avtomobil raqamini kiriting').max(12),
})

const slides = [
	{
		icon: MapPinned,
		title: 'Parkingni tez toping',
		text: "Uzbekistan bo'ylab SmartCity parkinglari, narx va bo'sh joylarni bitta joyda ko'ring.",
	},
	{
		icon: QrCode,
		title: 'Bron va QR',
		text: 'Joyni oldindan band qiling, QR orqali kirishni simulyatsiya qiling va sessiyani boshqaring.',
	},
	{
		icon: ShieldCheck,
		title: 'Bir oqimda yakunlang',
		text: "Taymer, vaqtni uzaytirish, chiqish, mock payment va chek — MVP oqimi to'liq ishlaydi.",
	},
]

function formatUzPhone(value: string) {
	const digits = value.replace(/\D/g, '').slice(0, 9)

	const operator = digits.slice(0, 2)
	const first = digits.slice(2, 5)
	const second = digits.slice(5, 7)
	const third = digits.slice(7, 9)

	return [operator, first, second, third].filter(Boolean).join(' ')
}

function normalizeUzPhone(digits: string) {
	return `+998${digits}`
}

// useSearchParams() opts the subtree into client-side rendering, so the
// reader lives behind its own Suspense boundary — the pattern /transport
// already uses.
export default function WelcomePage() {
	return (
		<Suspense fallback={<LoadingScreen />}>
			<WelcomeView />
		</Suspense>
	)
}

function WelcomeView() {
	const router = useRouter()
	// AuthGate sends the page the user was actually trying to reach.
	const next = resolveNextPath(useSearchParams().get('next'))
	const { hydrated, onboardingDone, user, completeOnboarding, login } = useApp()
	const [slide, setSlide] = useState(0)
	const [step, setStep] = useState<'phone' | 'otp' | 'profile'>('phone')
	const [phoneDigits, setPhoneDigits] = useState('')
	const [otp, setOtp] = useState('')
	const [name, setName] = useState('')
	const [vehiclePlate, setVehiclePlate] = useState('')
	const plateInputRef = useRef<HTMLInputElement>(null)
	const plateCaretRef = useRef<number | null>(null)
	const [error, setError] = useState('')

	useEffect(() => {
		if (hydrated && user) router.replace(next)
	}, [hydrated, user, router, next])

	// Re-place the caret once React has written the reformatted value, so
	// inserted spaces never push it to the end of the field.
	useEffect(() => {
		const input = plateInputRef.current
		const caret = plateCaretRef.current
		if (!input || caret === null) return
		plateCaretRef.current = null
		input.setSelectionRange(caret, caret)
	}, [vehiclePlate])
	const current = slides[slide]
	const Icon = current.icon
	const title = useMemo(
		() =>
			step === 'phone'
				? 'Telefon raqam'
				: step === 'otp'
					? 'SMS kod'
					: 'Profil',
		[step],
	)

	if (!hydrated || user) return <LoadingScreen />

	if (!onboardingDone) {
		return (
			<div className='min-h-dvh bg-ink px-6 py-8 text-white'>
				<div className='mx-auto flex min-h-[calc(100dvh-4rem)] max-w-md flex-col'>
					<div className='flex items-center gap-3'>
						<SmartCityLogo className='size-11 border border-white/10' />
						<strong>SmartCity</strong>
					</div>
					<div className='flex flex-1 flex-col justify-center'>
						<div className='grid size-24 place-items-center rounded-card-xl bg-white/10'>
							<Icon className='size-11' />
						</div>
						<p className='mt-8 text-[11px] font-bold uppercase tracking-[.2em] text-brand-100'>
							MVP · Uzbekistan
						</p>
						<h1 className='mt-3 text-[34px] font-black leading-[1.1] tracking-[-0.02em]'>
							{current.title}
						</h1>
						<p className='mt-4 max-w-sm text-[15px] leading-7 text-white/70'>
							{current.text}
						</p>
					</div>
					<div className='flex gap-2'>
						{slides.map((_, index) => (
							<span
								key={index}
								className={`h-1.5 rounded-full transition-all ${index === slide ? 'w-10 bg-white' : 'w-4 bg-white/25'}`}
							/>
						))}
					</div>
					<button
						onClick={() =>
							slide < slides.length - 1
								? setSlide(slide + 1)
								: completeOnboarding()
						}
						className='mt-6 h-14 rounded-xl bg-white text-[15px] font-[650] text-ink'
					>
						{slide < slides.length - 1 ? 'Keyingi' : 'Boshlash'}
					</button>
				</div>
			</div>
		)
	}

	function handlePlateChange(event: ChangeEvent<HTMLInputElement>) {
		const typed = event.target.value
		const caret = event.target.selectionStart ?? typed.length
		const previousRaw = normalizeUzbekPlate(vehiclePlate)

		let raw = normalizeUzbekPlate(typed)
		let charsBeforeCaret = normalizeUzbekPlate(typed.slice(0, caret)).length

		// Backspacing onto one of the inserted spaces would otherwise delete
		// only that space, which formatting puts straight back. Remove the
		// plate character in front of it instead, so Backspace always moves.
		// Exactly one character must have gone, or a paste that merely drops
		// spaces ("01A777AA" over "01 A 777 AA") would lose a character too.
		if (
			vehiclePlate.length - typed.length === 1 &&
			raw === previousRaw &&
			charsBeforeCaret > 0
		) {
			raw = raw.slice(0, charsBeforeCaret - 1) + raw.slice(charsBeforeCaret)
			charsBeforeCaret -= 1
		}

		const formatted = formatUzbekPlate(raw)

		// Caret goes after the same number of plate characters it was after.
		let position = 0
		let seen = 0
		while (position < formatted.length && seen < charsBeforeCaret) {
			if (formatted[position] !== ' ') seen += 1
			position += 1
		}

		plateCaretRef.current = position
		setVehiclePlate(formatted)
		setError('')
	}

	function submitPhone() {
		setError('')

		if (phoneDigits.length !== 9) {
			setError('Telefon raqamni to‘liq kiriting.')
			return
		}

		setStep('otp')
	}

	function submitOtp() {
		setError('')
		if (otp !== '123456') {
			setError('Demo kod: 123456')
			return
		}
		setStep('profile')
	}

	function submitProfile() {
		setError('')
		const parsed = profileSchema.safeParse({
			name,
			phone: normalizeUzPhone(phoneDigits),
			vehiclePlate,
		})
		if (!parsed.success) {
			setError(parsed.error.issues[0]?.message ?? "Ma'lumotlarni tekshiring")
			return
		}
		login(parsed.data)
		router.replace(next)
	}

	return (
		<div className='min-h-dvh bg-canvas px-5 py-8'>
			<div className='mx-auto max-w-md'>
				<div className='flex items-center gap-3'>
					<SmartCityLogo className='size-11 border border-ink/10' />
					<div>
						<strong className='block'>SmartCity</strong>
						<span className='text-[11.5px] text-ink-3'>Demo authentication</span>
					</div>
				</div>
				<section className='mt-10 rounded-card-xl bg-card p-6 shadow-card'>
					<div className='grid size-12 place-items-center rounded-card bg-brand-50 text-brand'>
						<Smartphone className='size-6' />
					</div>
					<p className='mt-6 text-[11px] font-bold uppercase tracking-[.16em] text-ink-3'>
						{title}
					</p>
					<h1 className='mt-2 text-[28px] font-black tracking-[-0.02em] text-ink'>Kirish</h1>

					{step === 'phone' && (
						<form
							className='mt-6'
							onSubmit={e => {
								e.preventDefault()
								submitPhone()
							}}
						>
							<label htmlFor='phone' className='text-[13px] font-semibold text-ink-2'>
								Telefon
							</label>

							<div className='mt-2 flex h-14 items-center rounded-card border border-line bg-white transition focus-within:border-brand'>
								<div className='flex h-full items-center border-r border-line px-4 text-[17px] font-semibold text-ink'>
									+998
								</div>

								<input
									id='phone'
									type='tel'
									inputMode='numeric'
									autoComplete='tel-national'
									autoFocus
									value={formatUzPhone(phoneDigits)}
									onChange={e => {
										const digits = e.target.value.replace(/\D/g, '').slice(0, 9)

										setPhoneDigits(digits)
										setError('')
									}}
									className='h-full min-w-0 flex-1 bg-transparent px-4 text-[17px] font-medium tracking-wide text-ink outline-none'
									placeholder='90 123 45 67'
								/>
							</div>

							<button
								type='submit'
								disabled={phoneDigits.length !== 9}
								className='mt-4 h-13 w-full rounded-xl bg-brand text-[15px] font-[650] text-white shadow-[0_6px_16px_rgb(108_71_224/.28)] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none'
							>
								OTP yuborish
							</button>
						</form>
					)}

					{step === 'otp' && (
						<form
							className='mt-6'
							onSubmit={e => {
								e.preventDefault()
								submitOtp()
							}}
						>
							<div className='rounded-card bg-info-bg p-3.5 text-[13px] leading-5 text-info'>
								<strong>Demo rejim:</strong> haqiqiy SMS yuborilmaydi. Kod{' '}
								<strong>123456</strong>.
							</div>

							<label htmlFor='otp' className='mt-5 block text-[13px] font-semibold text-ink-2'>
								6 xonali kod
							</label>

							<input
								id='otp'
								type='text'
								inputMode='numeric'
								autoComplete='one-time-code'
								autoFocus
								value={otp}
								onChange={e => {
									setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))
									setError('')
								}}
								className='mt-2 h-13 w-full rounded-card border border-line px-4 text-center font-mono text-2xl font-black tracking-[.35em] text-ink outline-none focus:border-brand'
								placeholder='123456'
							/>

							<button
								type='submit'
								disabled={otp.length !== 6}
								className='mt-4 h-13 w-full rounded-xl bg-brand text-[15px] font-[650] text-white shadow-[0_6px_16px_rgb(108_71_224/.28)] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none'
							>
								Tasdiqlash
							</button>
						</form>
					)}

					{step === 'profile' && (
						<form
							className='mt-6 space-y-4'
							onSubmit={e => {
								e.preventDefault()
								submitProfile()
							}}
						>
							<div>
								<label htmlFor='name' className='text-[13px] font-semibold text-ink-2'>
									Ism
								</label>

								<input
									id='name'
									value={name}
									autoFocus
									autoComplete='name'
									onChange={e => {
										setName(e.target.value)
										setError('')
									}}
									className='mt-2 h-13 w-full rounded-card border border-line px-4 text-ink outline-none focus:border-brand'
									placeholder='Ali'
								/>
							</div>

							<div>
								<label htmlFor='vehiclePlate' className='text-[13px] font-semibold text-ink-2'>
									Avtomobil davlat raqami
								</label>

								<div className='relative mt-2'>
									<CarFront className='absolute left-4 top-1/2 size-5 -translate-y-1/2 text-ink-3' />

									<input
										id='vehiclePlate'
										ref={plateInputRef}
										value={vehiclePlate}
										inputMode='text'
										autoCapitalize='characters'
										autoComplete='off'
										spellCheck={false}
										onChange={handlePlateChange}
										className='h-13 w-full rounded-card border border-line pl-12 pr-4 font-mono font-bold text-ink outline-none focus:border-brand'
									/>
								</div>
							</div>

							<button
								type='submit'
								className='h-13 w-full rounded-xl bg-brand text-[15px] font-[650] text-white shadow-[0_6px_16px_rgb(108_71_224/.28)]'
							>
								<span className='inline-flex items-center gap-2'>
									<Check className='size-5' />
									Profilni yaratish
								</span>
							</button>
						</form>
					)}

					{error && (
						<p className='mt-4 rounded-card bg-bad-bg p-3 text-[13px] font-medium text-bad'>
							{error}
						</p>
					)}
				</section>
			</div>
		</div>
	)
}
