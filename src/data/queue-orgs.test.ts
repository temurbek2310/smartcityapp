import { describe, expect, it } from 'vitest'

import { PLACES, getPlace } from '@/data/places'
import {
	QUEUE_ORGS,
	getQueueOrgByPlace,
	placeQueueWaitMinutes,
} from '@/data/queue-orgs'

// Every queue desk is a venue in the place catalog, once. Two names for one
// venue — «Bank xizmatlari» and «Ipoteka Bank» — is what this guards against.
describe('QUEUE_ORGS · place link', () => {
	it('maps every organisation to a real place, one to one', () => {
		const placeIds = QUEUE_ORGS.map(org => org.placeId)
		expect(new Set(placeIds).size).toBe(placeIds.length)
		for (const org of QUEUE_ORGS) expect(getPlace(org.placeId)).toBeDefined()
	})

	it('reads title, address and position from the place, never its own copy', () => {
		for (const org of QUEUE_ORGS) {
			const place = getPlace(org.placeId)!
			expect(org.title).toBe(place.title)
			expect(org.address).toBe(place.address)
			expect([org.lat, org.lng]).toEqual([place.lat, place.lng])
			expect(org.parkingId).toBe(place.parkingId)
		}
	})

	it('merges the bank and the car service into their places', () => {
		expect(getQueueOrgByPlace('bank-office')?.id).toBe('ipoteka-bank')
		expect(getQueueOrgByPlace('cto-master')?.id).toBe('avto-servis')
		expect(PLACES.map(place => place.title)).not.toContain('Bank xizmatlari')
		expect(QUEUE_ORGS.map(org => org.title)).not.toContain('Avto Servis Plus')
	})
})

describe('placeQueueWaitMinutes', () => {
	it('quotes the venue’s live queue', () => {
		for (const org of QUEUE_ORGS)
			expect(placeQueueWaitMinutes(org.placeId)).toBe(org.waitMinutes)
	})

	it('quotes a named line’s own wait', () => {
		const bank = getQueueOrgByPlace('bank-office')!
		const credit = bank.services.find(service => service.id === 'credit')!
		expect(placeQueueWaitMinutes('bank-office', 'credit')).toBe(
			credit.avgWaitMinutes,
		)
	})

	it('shows no wait for a venue with no queue', () => {
		const withoutQueue = PLACES.filter(place => !getQueueOrgByPlace(place.id))
		expect(withoutQueue.length).toBeGreaterThan(0)
		for (const place of withoutQueue)
			expect(placeQueueWaitMinutes(place.id)).toBeUndefined()
	})
})
