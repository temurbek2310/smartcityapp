export function SmartCityLogo({
	className = 'size-11',
	rounded = 'rounded-card',
}: {
	className?: string
	rounded?: string
}) {
	return (
		<span
			className={`relative grid shrink-0 place-items-center overflow-hidden bg-ink shadow-md ${rounded} ${className}`}
		>
			<svg
				viewBox="0 0 512 512"
				className="size-full p-1.5"
				fill="none"
				xmlns="http://www.w3.org/2000/svg"
			>
				<defs>
					<linearGradient id="scLogoBrand" x1="120" y1="120" x2="380" y2="390" gradientUnits="userSpaceOnUse">
						<stop offset="0%" stopColor="#9065FA" />
						<stop offset="50%" stopColor="#6C47E0" />
						<stop offset="100%" stopColor="#4F2EC9" />
					</linearGradient>
					<linearGradient id="scLogoTeal" x1="140" y1="120" x2="370" y2="380" gradientUnits="userSpaceOnUse">
						<stop offset="0%" stopColor="#38BDF8" />
						<stop offset="50%" stopColor="#06B6D4" />
						<stop offset="100%" stopColor="#10B981" />
					</linearGradient>
				</defs>

				{/* Architectural Backdrop */}
				<rect x="208" y="208" width="24" height="106" rx="6" fill="url(#scLogoTeal)" opacity="0.3" />
				<rect x="244" y="166" width="24" height="148" rx="6" fill="url(#scLogoTeal)" opacity="0.45" />
				<rect x="280" y="196" width="24" height="118" rx="6" fill="url(#scLogoTeal)" opacity="0.32" />

				{/* S Monogram */}
				<path
					d="M352 168 C338 140, 302 124, 252 124 C184 124, 146 162, 146 208 C146 250, 180 274, 238 290 L274 300 C322 314, 348 334, 348 372 C348 418, 308 444, 248 444 C192 444, 154 416, 142 388"
					stroke="url(#scLogoBrand)"
					strokeWidth="48"
					strokeLinecap="round"
					strokeLinejoin="round"
				/>

				{/* Neon Core */}
				<path
					d="M346 172 C330 144, 298 132, 252 132 C190 132, 156 166, 156 208 C156 244, 186 266, 242 282 L278 292 C328 308, 356 332, 356 372 C356 422, 314 444, 248 444 C196 444, 160 418, 148 392"
					stroke="url(#scLogoTeal)"
					strokeWidth="16"
					strokeLinecap="round"
					strokeLinejoin="round"
				/>

				{/* Waypoint nodes */}
				<circle cx="252" cy="132" r="7" fill="#FFFFFF" />
				<circle cx="260" cy="287" r="7" fill="#FFFFFF" />
				<circle cx="248" cy="444" r="7" fill="#FFFFFF" />

				{/* Smart Beacon */}
				<circle cx="366" cy="146" r="30" fill="url(#scLogoTeal)" />
				<circle cx="366" cy="146" r="14" fill="#FFFFFF" />
			</svg>
		</span>
	)
}
