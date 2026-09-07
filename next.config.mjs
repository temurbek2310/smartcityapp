import withSerwistInit from '@serwist/next'

const withSerwist = withSerwistInit({
	swSrc: 'src/app/sw.ts',
	swDest: 'public/sw.js',

	// Development paytida SW ni o‘chirib turamiz.
	disable: process.env.NODE_ENV !== 'production',
})

const nextConfig = {}

export default withSerwist(nextConfig)
