import withSerwistInit from '@serwist/next'

const withSerwist = withSerwistInit({
	swSrc: 'src/app/sw.ts',
	swDest: 'public/sw.js',

	// Development paytida SW ni o‘chirib turamiz.
	disable: process.env.NODE_ENV !== 'production',
})

const nextConfig = {
	// Next blocks cross-origin requests to dev-only assets, so reaching the
	// dev server from a phone on the LAN needs that host allowed.
	//
	// Bare hostnames only: Next reads the Origin header's .hostname and
	// matches it by splitting on dots, so "http://host:3000" can never match.
	// (The upstream docs example is written for next.config.js and wraps this
	// in module.exports, which in a .mjs file assigns to an object nothing
	// exports — the setting then silently does nothing.)
	allowedDevOrigins: ['192.168.100.3'],
}

export default withSerwist(nextConfig)
