'use client'

import { Download, Share2, Smartphone, X } from 'lucide-react'
import { useEffect, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
	prompt: () => Promise<void>
	userChoice: Promise<{
		outcome: 'accepted' | 'dismissed'
		platform: string
	}>
}

export function InstallAppPrompt() {
	const [visible, setVisible] = useState(false)
	const isIOS =
		typeof navigator !== 'undefined' &&
		/iphone|ipad|ipod/i.test(navigator.userAgent)

	const [installPrompt, setInstallPrompt] =
		useState<BeforeInstallPromptEvent | null>(null)

	const [showHelp, setShowHelp] = useState(false)

	useEffect(() => {
		// Serwist is disabled in development. Also unregister any old localhost
		// service worker so stale PWA caches cannot break Next.js HMR/assets.
		if (process.env.NODE_ENV === 'development') {
			if ('serviceWorker' in navigator) {
				void navigator.serviceWorker
					.getRegistrations()
					.then(registrations => {
						for (const registration of registrations) {
							void registration.unregister()
						}
					})
					.catch(() => undefined)
			}

			return
		}

		const isStandalone =
			window.matchMedia('(display-mode: standalone)').matches ||
			Boolean(
				(
					window.navigator as Navigator & {
						standalone?: boolean
					}
				).standalone,
			)

		if (isStandalone) {
			return
		}

		const dismissed =
			sessionStorage.getItem('smartcity-install-dismissed') === 'true'

		if (dismissed) {
			return
		}

		// iOS has no beforeinstallprompt event, so show manual instructions there.
		// Other platforms wait for the browser's real install event.
		const timer = isIOS
			? window.setTimeout(() => {
				setVisible(true)
			}, 1200)
			: undefined

		const handleBeforeInstallPrompt = (event: Event) => {
			event.preventDefault()

			setInstallPrompt(event as BeforeInstallPromptEvent)

			setVisible(true)
		}

		const handleInstalled = () => {
			setVisible(false)
			setInstallPrompt(null)
		}

		window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

		window.addEventListener('appinstalled', handleInstalled)

		return () => {
			if (timer !== undefined) window.clearTimeout(timer)

			window.removeEventListener(
				'beforeinstallprompt',
				handleBeforeInstallPrompt,
			)

			window.removeEventListener('appinstalled', handleInstalled)
		}
	}, [isIOS])

	function dismiss() {
		sessionStorage.setItem('smartcity-install-dismissed', 'true')

		setVisible(false)
	}

	async function handleInstall() {
		if (isIOS) {
			setShowHelp(true)
			return
		}

		if (!installPrompt) {
			setShowHelp(true)
			return
		}

		await installPrompt.prompt()

		const result = await installPrompt.userChoice

		if (result.outcome === 'accepted') {
			setVisible(false)
		}

		setInstallPrompt(null)
	}

	if (!visible) {
		return null
	}

	return (
		<div className='fixed bottom-24 left-1/2 z-100 w-[calc(100%-24px)] max-w-sm -translate-x-1/2'>
			<div
				className='
				  animate-fade-up
          overflow-hidden
          rounded-[26px]
          border border-white/80
          bg-white/80
          p-4
          shadow-[0_18px_60px_rgba(15,23,42,0.16)]
          backdrop-blur-2xl
        '
			>
				<div className='flex items-start gap-3'>
					<div
						className='
              flex h-12 w-12 shrink-0
              items-center justify-center
              rounded-2xl
              bg-ink
              text-white
              shadow-lg
            '
					>
						<Smartphone size={21} />
					</div>

					<div className='min-w-0 flex-1'>
						<div className='flex items-start justify-between gap-3'>
							<div>
								<p className='font-bold text-ink'>
									SmartCity ilovasini o‘rnating
								</p>

								<p className='mt-1 text-sm leading-5 text-ink-3'>
									Tezroq kirish va mobil app ko‘rinishida foydalaning.
								</p>
							</div>

							<button
								type='button'
								onClick={dismiss}
								aria-label='Yopish'
								className='
                  flex h-8 w-8 shrink-0
                  items-center justify-center
                  rounded-full
                  bg-card-2
                  text-ink-3
				  citygo-pressable
                  hover:bg-line
                '
							>
								<X size={15} />
							</button>
						</div>

						{!showHelp ? (
							<button
								type='button'
								onClick={handleInstall}
								className='
                  mt-4
                  flex h-11 w-full
                  items-center justify-center gap-2
                  rounded-2xl
                  bg-linear-to-r
                  from-emerald-500
                  to-teal-500
                  px-4
                  text-sm font-bold
                  text-white
                  shadow-sm
				  citygo-pressable
                '
							>
								{isIOS ? (
									<>
										<Share2 size={17} />
										O‘rnatish
									</>
								) : (
									<>
										<Download size={17} />SmartCity’ni o‘rnatish
									</>
								)}
							</button>
						) : (
							<div className='mt-4 rounded-2xl bg-canvas p-3'>
								{isIOS ? (
									<>
										<p className='text-sm font-bold text-ink'>
											iPhone / iPad
										</p>

										<p className='mt-1 text-sm leading-5 text-ink-3'>
											Safari pastidagi{' '}
											<strong className='text-ink'>Share</strong>{' '}
											tugmasini bosing va{' '}
											<strong className='text-ink'>
												Add to Home Screen
											</strong>{' '}
											ni tanlang.
										</p>
									</>
								) : (
									<>
										<p className='text-sm font-bold text-ink'>
											Install hali tayyor emas
										</p>

										<p className='mt-1 text-sm leading-5 text-ink-3'>
											PWA service worker va manifest to‘liq ishga tushgandan
											keyin brauzerning native install oynasi shu tugma orqali
											ochiladi.
										</p>
									</>
								)}
							</div>
						)}
					</div>
				</div>
			</div>
		</div>
	)
}
