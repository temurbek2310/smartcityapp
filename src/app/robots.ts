import type { MetadataRoute } from 'next'

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

export default function robots(): MetadataRoute.Robots {
	return {
		rules: {
			userAgent: '*',

			allow: ['/', '/welcome'],

			disallow: [
				'/home',
				'/bookings',
				'/favorites',
				'/profile',
				'/reserve/',
				'/reservation/',
				'/session/',
				'/receipt/',
			],
		},

		sitemap: `${siteUrl}/sitemap.xml`,
	}
}
