'use client'

import { useParams } from 'next/navigation'

import { BookingDetail } from '@/components/booking/booking-detail'

// A queue ticket — the page queueTicketHref() points at, from the sheet that
// took the number and from its card in Bron.
export default function QueueTicketPage() {
	const params = useParams<{ id: string }>()
	return <BookingDetail source='queue' id={params.id} />
}
