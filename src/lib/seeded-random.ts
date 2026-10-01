// Deterministic pseudo-randomness for the availability engines.
//
// The parking floor plan (bay-map) and the queue desk board (queue-desks) both
// draw who is busy from a seed rather than Math.random(): the grid is rendered
// on the server and again on the client, so a random layout would hydrate
// into a different picture than it painted, and someone who backs out and
// returns has to find the same bay or desk still free.
//
// The arithmetic is exactly what bay-map has always used — an FNV-1a style
// hash folded into a five-digit seed, walked by a cheap LCG — so moving it
// here changes no parking layout.

// A seed from a string and two numbers. `a` and `b` are mixed into the
// offset basis the way bayMap mixed level and bay count.
export function seedFor(key: string, a: number, b: number) {
	let hash = 2166136261 ^ (a * 31 + b)
	for (let index = 0; index < key.length; index += 1) {
		hash ^= key.charCodeAt(index)
		hash = Math.imul(hash, 16777619)
	}
	return (hash >>> 0) % 99991
}

// A generator of numbers in [0, 1). The same seed always yields the same
// sequence, on every engine.
export function makeRandom(seed: number) {
	let state = seed || 1
	return () => {
		state = (state * 1103515245 + 12345) % 2147483648
		return state / 2147483648
	}
}

// Fisher-Yates over 0..length-1, driven by `random`. An explicit shuffle
// rather than Array.sort() with a random comparator, whose result depends on
// the engine's sort.
export function seededOrder(length: number, random: () => number) {
	const order = Array.from({ length }, (_, index) => index)
	for (let index = order.length - 1; index > 0; index -= 1) {
		const swap = Math.floor(random() * (index + 1))
		;[order[index], order[swap]] = [order[swap], order[index]]
	}
	return order
}
