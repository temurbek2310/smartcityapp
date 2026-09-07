const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

export function StructuredData() {
	const data = {
		'@context': 'https://schema.org',

		'@type': 'WebApplication',

		name: 'B SPACE',

		url: siteUrl,

		applicationCategory: 'TravelApplication',

		operatingSystem: 'Web, Android, iOS',

		description:
			'Smart parking platform for finding and reserving parking spaces in Uzbekistan.',

		areaServed: {
			'@type': 'Country',
			name: 'Uzbekistan',
		},

		offers: {
			'@type': 'Offer',
			price: '0',
			priceCurrency: 'UZS',
		},
	}

	return (
		<script
			type='application/ld+json'
			dangerouslySetInnerHTML={{
				__html: JSON.stringify(data),
			}}
		/>
	)
}
