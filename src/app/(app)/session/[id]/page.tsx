'use client'

import { notFound, useParams, useRouter } from 'next/navigation'
import { useEffect } from 'react'

import { AppBar } from '@/components/ui/app-bar'
import { Card } from '@/components/ui/card'
import { useApp } from '@/context/app-context'
import { reservationHref } from '@/lib/reservation'

// A parking booking has one customer-facing page — /reservation/[id] — which
// renders the running session itself once the car is inside. This route stays
// as the compatibility shim for the links that predate that: older Bron
// cards, the parking banner's ?exit=1 deep link, anything bookmarked. It
// carries nothing of its own, deliberately, because a second copy of the
// timer and the exit is exactly what this consolidation removed.
export default function SessionPage() {
	const params = useParams<{ id: string }>()
	const router = useRouter()
	const { reservations } = useApp()

	const reservation = reservations.find(item => item.id === params.id)
	const href = reservation ? reservationHref(reservation) : null

	useEffect(() => {
		if (!href) return
		// The query rides along, so ?exit=1 still opens the exit sheet on the
		// page that now draws it. Read off location rather than through
		// useSearchParams(), the way AuthGate does, so this route keeps its own
		// rendering mode.
		router.replace(href + window.location.search)
	}, [href, router])

	if (!reservation) notFound()

	return (
		<div className='-mx-5 -mt-6 min-h-[calc(100dvh-var(--spacing-nav))] bg-canvas pb-28 pt-5'>
			<div className='mx-auto w-full max-w-md space-y-3 px-4'>
				<AppBar title='Parking sessiyasi' />
				<Card className='text-center'>
					<p className='text-[12.5px] text-ink-3'>Yo‘naltirilmoqda…</p>
				</Card>
			</div>
		</div>
	)
}
