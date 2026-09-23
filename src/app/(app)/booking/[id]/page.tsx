'use client'

import { useParams } from 'next/navigation'

import { BookingDetail } from '@/components/booking/booking-detail'

// A table, cinema, clinic or event booking — the page serviceBookingHref()
// points at, from the sheet that made it and from its card in Bron.
export default function ServiceBookingPage() {
	const params = useParams<{ id: string }>()
	return <BookingDetail source='service' id={params.id} />
}
