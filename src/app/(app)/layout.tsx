import { AuthGate } from '@/components/app-shell/auth-gate'
import { BottomNavigation } from '@/components/app-shell/bottom-navigation'
import { MobileHeader } from '@/components/app-shell/mobile-header'
import { PullToRefresh } from '@/components/ui/pull-to-refresh'

export default function AppLayout({
	children,
}: Readonly<{
	children: React.ReactNode
}>) {
	return (
		<AuthGate>
			<div className='min-h-dvh bg-slate-200'>
				<div className='relative mx-auto min-h-dvh w-full max-w-md bg-white shadow-xl'>
					<MobileHeader />

					<PullToRefresh>
						<main className='px-5 pb-28 pt-6'>{children}</main>
					</PullToRefresh>

					<BottomNavigation />
				</div>
			</div>
		</AuthGate>
	)
}
