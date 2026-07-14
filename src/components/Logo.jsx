import { useId } from 'react'

/**
 * GeoHive brand mark — classic hexagonal hive + spatial node.
 */
export default function Logo({
  size = 40,
  showWordmark = true,
  variant = 'full',
  className = '',
}) {
  const uid = useId().replace(/:/g, '')

  return (
    <div
      className={`geohive-logo ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: size * 0.28,
        lineHeight: 1,
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="GeoHive"
        role="img"
        style={{ flexShrink: 0, display: 'block' }}
      >
        <defs>
          <linearGradient
            id={`${uid}-g`}
            x1="8"
            y1="4"
            x2="56"
            y2="60"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#00e5a8" />
            <stop offset="0.55" stopColor="#14b8a6" />
            <stop offset="1" stopColor="#3b82f6" />
          </linearGradient>
          <linearGradient
            id={`${uid}-in`}
            x1="22"
            y1="18"
            x2="42"
            y2="46"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#5eead4" />
            <stop offset="1" stopColor="#38bdf8" />
          </linearGradient>
        </defs>

        <circle cx="32" cy="32" r="30" fill="#0a121c" opacity="0.35" />

        {/* Outer hexagon — hive */}
        <path
          d="M32 6 L54 18.5 V41.5 L32 54 L10 41.5 V18.5 Z"
          stroke={`url(#${uid}-g)`}
          strokeWidth="2.4"
          strokeLinejoin="round"
          fill="rgba(0, 229, 168, 0.06)"
        />

        {/* Inner hexagon */}
        <path
          d="M32 16 L44 23 V37 L32 44 L20 37 V23 Z"
          stroke={`url(#${uid}-in)`}
          strokeWidth="1.6"
          strokeLinejoin="round"
          fill="rgba(0, 229, 168, 0.12)"
        />

        {/* Hive cell */}
        <path
          d="M26 28 L32 24.5 L38 28 V35 L32 38.5 L26 35 Z"
          fill={`url(#${uid}-g)`}
          opacity="0.9"
        />

        {/* Spatial node */}
        <circle cx="32" cy="31.5" r="3.2" fill="#041016" />
        <circle cx="32" cy="31.5" r="1.8" fill="#f0fdf9" />

        {/* Meridian arcs */}
        <path
          d="M18 32 Q32 22 46 32"
          stroke={`url(#${uid}-g)`}
          strokeWidth="1"
          opacity="0.35"
          fill="none"
        />
        <path
          d="M18 32 Q32 42 46 32"
          stroke={`url(#${uid}-g)`}
          strokeWidth="1"
          opacity="0.35"
          fill="none"
        />
      </svg>

      {showWordmark && variant !== 'mark' && (
        <span
          className="geohive-wordmark"
          style={{
            fontFamily: 'Outfit, system-ui, sans-serif',
            fontWeight: 700,
            fontSize: size * 0.42,
            letterSpacing: '-0.03em',
            color: variant === 'light' ? '#041016' : '#e8eef7',
            whiteSpace: 'nowrap',
          }}
        >
          Geo
          <em
            style={{
              fontStyle: 'normal',
              background: 'linear-gradient(135deg, #00e5a8 0%, #3b82f6 100%)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              color: 'transparent',
            }}
          >
            Hive
          </em>
        </span>
      )}
    </div>
  )
}
