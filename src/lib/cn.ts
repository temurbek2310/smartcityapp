// Join class names, dropping anything falsy. Small enough not to warrant a
// dependency, and every primitive needs it to merge its own classes with a
// caller's className.
export function cn(...parts: Array<string | false | null | undefined>) {
	return parts.filter(Boolean).join(' ')
}
