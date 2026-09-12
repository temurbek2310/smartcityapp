'use client'

import {
	useRef,
	type MouseEvent as ReactMouseEvent,
	type PointerEvent as ReactPointerEvent,
	type ReactNode,
	type WheelEvent as ReactWheelEvent,
} from 'react'

// Drag-to-scroll / wheel-to-scroll horizontal row used by Home's chip rows
// and the /transport mode selector and alternative-route cards.
export function HorizontalRail({
	children,
	className = '',
}: {
	children: ReactNode
	className?: string
}) {
	const ref = useRef<HTMLDivElement>(null)
	const drag = useRef({
		down: false,
		pointerId: -1,
		x: 0,
		scroll: 0,
		moved: false,
	})

	function onWheel(event: ReactWheelEvent<HTMLDivElement>) {
		const element = ref.current
		if (!element || element.scrollWidth <= element.clientWidth) return
		if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
			event.preventDefault()
			element.scrollLeft += event.deltaY
		}
	}

	function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
		if (event.pointerType !== 'mouse' || event.button !== 0) return
		const element = ref.current
		if (!element) return

		// Do not capture here. Immediate pointer capture steals clicks from
		// cards and heart buttons. Capture only once a real drag begins.
		drag.current = {
			down: true,
			pointerId: event.pointerId,
			x: event.clientX,
			scroll: element.scrollLeft,
			moved: false,
		}
	}

	function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
		const element = ref.current
		if (
			!element ||
			!drag.current.down ||
			drag.current.pointerId !== event.pointerId
		)
			return

		const delta = event.clientX - drag.current.x
		if (!drag.current.moved && Math.abs(delta) > 6) {
			drag.current.moved = true
			element.setPointerCapture(event.pointerId)
		}

		if (drag.current.moved) {
			element.scrollLeft = drag.current.scroll - delta
		}
	}

	function stopPointer(event: ReactPointerEvent<HTMLDivElement>) {
		const element = ref.current
		drag.current.down = false
		if (element?.hasPointerCapture(event.pointerId)) {
			element.releasePointerCapture(event.pointerId)
		}
	}

	function onClickCapture(event: ReactMouseEvent<HTMLDivElement>) {
		// A true drag should not open a card. An ordinary click must pass through.
		if (!drag.current.moved) return
		event.preventDefault()
		event.stopPropagation()
		drag.current.moved = false
	}

	return (
		<div
			ref={ref}
			onWheel={onWheel}
			onPointerDown={onPointerDown}
			onPointerMove={onPointerMove}
			onPointerUp={stopPointer}
			onPointerCancel={stopPointer}
			data-no-ptr
			onClickCapture={onClickCapture}
			onDragStart={event => event.preventDefault()}
			className={`flex w-full min-w-0 gap-3 overflow-x-auto overflow-y-hidden overscroll-x-contain pb-2 scrollbar-none [&::-webkit-scrollbar]:hidden ${className}`}
			style={{ touchAction: 'pan-x', WebkitOverflowScrolling: 'touch' }}
		>
			{children}
		</div>
	)
}
