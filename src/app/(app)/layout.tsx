import { AuthGate } from '@/components/app-shell/auth-gate'
import { BottomNavigation } from '@/components/app-shell/bottom-navigation'
import { PullToRefresh } from '@/components/ui/pull-to-refresh'

export default function AppLayout({
	children,
}: Readonly<{
	children: React.ReactNode
}>) {
	return (
		<AuthGate>
			<div className='min-h-dvh bg-canvas'>
				<div className='relative mx-auto min-h-dvh w-full max-w-md bg-card shadow-xl'>
					<PullToRefresh>
						<main className='px-5 pb-28 pt-6'>{children}</main>
					</PullToRefresh>

					<BottomNavigation />
				</div>
			</div>
		</AuthGate>
	)
}
