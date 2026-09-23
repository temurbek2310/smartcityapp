import type { MetadataRoute } from 'next'

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

export default function robots(): MetadataRoute.Robots {
	return {
		rules: {
			userAgent: '*',

			allow: ['/', '/welcome'],

			// Everything behind AuthGate. The list had drifted: /transport and
			// /parking were reachable to crawlers even though a signed-out
			// visitor only ever sees the loading screen.
			disallow: [
				'/home',
				'/bookings',
				'/favorites',
				'/profile',
				'/news',
				'/notifications',
				'/queues',
				'/parking',
				'/transport',
				'/booking/',
				'/reservation/',
				'/session/',
				'/receipt/',
			],
		},

		sitemap: `${siteUrl}/sitemap.xml`,
	}
}
