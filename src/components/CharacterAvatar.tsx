import * as React from 'react'
import type { AvatarCharacterConfig } from '@/lib/avatar'
import { DEFAULT_CHARACTER, darken, normalizeCharacter } from '@/lib/avatar'
import { cn } from '@/lib/utils'

interface CharacterAvatarProps {
  config?: Partial<AvatarCharacterConfig> | null
  /** Tamaño en píxeles del lado del SVG. */
  size?: number
  className?: string
  /** Dibuja el fondo de color. Desactívalo para componerlo sobre otro fondo. */
  withBackground?: boolean
  title?: string
}

/* ─────────────────────────────  Cabello  ───────────────────────────── */

function BackHair({ style, color }: { style: AvatarCharacterConfig['hairStyle']; color: string }) {
  const shade = darken(color, 0.16)
  switch (style) {
    case 'long':
      return (
        <path
          d="M24 50 Q22 82 34 86 Q30 70 32 52 Q40 36 50 36 Q60 36 68 52 Q70 70 66 86 Q78 82 76 50 Q76 26 50 26 Q24 26 24 50 Z"
          fill={shade}
        />
      )
    case 'curly':
      return (
        <g fill={shade}>
          <circle cx="28" cy="44" r="9" />
          <circle cx="72" cy="44" r="9" />
          <circle cx="34" cy="32" r="9" />
          <circle cx="66" cy="32" r="9" />
          <circle cx="50" cy="27" r="10" />
        </g>
      )
    default:
      return null
  }
}

function TopHair({ style, color }: { style: AvatarCharacterConfig['hairStyle']; color: string }) {
  const shade = darken(color, 0.08)
  switch (style) {
    case 'none':
      return null
    case 'buzz':
      return (
        <path
          d="M28 46 Q28 28 50 28 Q72 28 72 46 Q72 38 50 37 Q28 38 28 46 Z"
          fill={shade}
          opacity={0.92}
        />
      )
    case 'short':
      return (
        <path
          d="M27 47 Q26 27 50 27 Q74 27 73 47 Q70 38 60 37 Q57 41 50 41 Q43 41 40 37 Q30 38 27 47 Z"
          fill={shade}
        />
      )
    case 'wavy':
      return (
        <path
          d="M26 48 Q25 27 50 27 Q75 27 74 48 Q70 41 66 44 Q62 39 57 43 Q53 38 50 42 Q47 38 43 43 Q38 39 34 44 Q30 41 26 48 Z"
          fill={shade}
        />
      )
    case 'curly':
      return (
        <g fill={shade}>
          <circle cx="34" cy="36" r="8" />
          <circle cx="50" cy="31" r="9" />
          <circle cx="66" cy="36" r="8" />
          <circle cx="42" cy="32" r="7" />
          <circle cx="58" cy="32" r="7" />
        </g>
      )
    case 'long':
      return (
        <path
          d="M27 47 Q26 27 50 27 Q74 27 73 47 Q70 38 60 37 Q57 41 50 41 Q43 41 40 37 Q30 38 27 47 Z"
          fill={shade}
        />
      )
    case 'bun':
      return (
        <>
          <circle cx="50" cy="22" r="8" fill={shade} />
          <path
            d="M28 46 Q28 29 50 29 Q72 29 72 46 Q70 39 50 38 Q30 39 28 46 Z"
            fill={shade}
          />
        </>
      )
    case 'mohawk':
      return (
        <path
          d="M45 26 Q50 14 55 26 L55 40 Q50 38 45 40 Z"
          fill={shade}
        />
      )
    default:
      return null
  }
}

/* ─────────────────────────────  Cejas  ───────────────────────────── */

function Eyebrows({ style, color }: { style: AvatarCharacterConfig['eyebrowStyle']; color: string }) {
  const stroke = darken(color, 0.1)
  const common = {
    stroke,
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    fill: 'none',
  }
  switch (style) {
    case 'raised':
      return (
        <g {...common}>
          <path d="M35 41 Q41 37 47 40" />
          <path d="M53 40 Q59 37 65 41" />
        </g>
      )
    case 'serious':
      return (
        <g {...common}>
          <path d="M35 42 L47 44" />
          <path d="M53 44 L65 42" />
        </g>
      )
    case 'worried':
      return (
        <g {...common}>
          <path d="M35 43 L47 41" />
          <path d="M53 41 L65 43" />
        </g>
      )
    case 'default':
    default:
      return (
        <g {...common}>
          <path d="M35 43 Q41 40 47 43" />
          <path d="M53 43 Q59 40 65 43" />
        </g>
      )
  }
}

/* ─────────────────────────────  Ojos  ───────────────────────────── */

function Eye({ cx, color, style, winkClosed }: { cx: number; color: string; style: AvatarCharacterConfig['eyeStyle']; winkClosed?: boolean }) {
  const cy = 50
  if (winkClosed) {
    return <path d={`M${cx - 4} ${cy} Q${cx} ${cy + 3} ${cx + 4} ${cy}`} stroke="#3b2a1e" strokeWidth={2} strokeLinecap="round" fill="none" />
  }

  if (style === 'sleepy') {
    return (
      <g>
        <ellipse cx={cx} cy={cy + 0.5} rx={4.2} ry={2.6} fill="#ffffff" />
        <circle cx={cx} cy={cy + 1} r={2} fill={color} />
        <circle cx={cx} cy={cy + 1} r={0.9} fill="#111111" />
        <path d={`M${cx - 4.4} ${cy - 1.5} Q${cx} ${cy - 3} ${cx + 4.4} ${cy - 1.5}`} stroke="#3b2a1e" strokeWidth={1.4} strokeLinecap="round" fill="none" />
      </g>
    )
  }

  const r = style === 'round' ? 4.8 : 4
  const iris = style === 'round' ? 2.3 : 2
  return (
    <g>
      <ellipse cx={cx} cy={cy} rx={r * 0.9} ry={r} fill="#ffffff" />
      <circle cx={cx} cy={cy + 0.5} r={iris} fill={color} />
      <circle cx={cx} cy={cy + 0.5} r={0.9} fill="#111111" />
      <circle cx={cx - 0.9} cy={cy - 0.7} r={0.7} fill="#ffffff" />
    </g>
  )
}

function Eyes({ style, color }: { style: AvatarCharacterConfig['eyeStyle']; color: string }) {
  return (
    <g>
      <Eye cx={40} color={color} style={style} />
      <Eye cx={60} color={color} style={style} winkClosed={style === 'wink'} />
    </g>
  )
}

/* ─────────────────────────────  Boca  ───────────────────────────── */

function Mouth({ style }: { style: AvatarCharacterConfig['mouth'] }) {
  const lip = '#b5476b'
  switch (style) {
    case 'neutral':
      return <path d="M44 66 L56 66" stroke="#8a4b54" strokeWidth={2} strokeLinecap="round" fill="none" />
    case 'grin':
      return (
        <g>
          <path d="M43 64 Q50 73 57 64 Z" fill={lip} />
          <path d="M44.5 64.6 Q50 67 55.5 64.6 Z" fill="#ffffff" />
        </g>
      )
    case 'open':
      return <ellipse cx={50} cy={67} rx={4} ry={5} fill={lip} />
    case 'smirk':
      return <path d="M44 66 Q50 68 57 62" stroke="#8a4b54" strokeWidth={2} strokeLinecap="round" fill="none" />
    case 'smile':
    default:
      return <path d="M43 64 Q50 70 57 64" stroke="#8a4b54" strokeWidth={2} strokeLinecap="round" fill="none" />
  }
}

/* ──────────────────────────  Vello facial  ─────────────────────────── */

function FacialHair({ style, color }: { style: AvatarCharacterConfig['facialHair']; color: string }) {
  switch (style) {
    case 'none':
      return null
    case 'stubble':
      return (
        <path
          d="M30 56 Q34 78 50 79 Q66 78 70 56 Q66 70 50 71 Q34 70 30 56 Z"
          fill={color}
          opacity={0.22}
        />
      )
    case 'mustache':
      return <path d="M43 61 Q47 60 50 62 Q53 60 57 61 Q53 64 50 62.5 Q47 64 43 61 Z" fill={color} />
    case 'goatee':
      return (
        <g fill={color}>
          <path d="M43 61 Q47 60 50 62 Q53 60 57 61 Q53 63.5 50 62.5 Q47 63.5 43 61 Z" />
          <path d="M46 70 Q50 76 54 70 Q52 73 50 73 Q48 73 46 70 Z" />
        </g>
      )
    case 'beard':
      return (
        <g fill={color}>
          <path d="M28 52 Q31 80 50 81 Q69 80 72 52 Q68 71 50 72 Q32 71 28 52 Z" />
          <path d="M43 61 Q47 60 50 62 Q53 60 57 61 Q53 64 50 62.5 Q47 64 43 61 Z" />
        </g>
      )
    default:
      return null
  }
}

/* ──────────────────────────  Accesorios  ─────────────────────────── */

function Accessory({ style }: { style: AvatarCharacterConfig['accessory'] }) {
  const frame = '#2b2b2b'
  switch (style) {
    case 'glasses':
      return (
        <g stroke={frame} strokeWidth={1.6} fill="none">
          <rect x={33} y={45} width={13} height={10} rx={3} />
          <rect x={54} y={45} width={13} height={10} rx={3} />
          <path d="M46 49 L54 49" />
          <path d="M33 48 L29 47" />
          <path d="M67 48 L71 47" />
        </g>
      )
    case 'round-glasses':
      return (
        <g stroke={frame} strokeWidth={1.6} fill="none">
          <circle cx={40} cy={50} r={6.5} />
          <circle cx={60} cy={50} r={6.5} />
          <path d="M46.5 50 L53.5 50" />
          <path d="M33.5 49 L29 47" />
          <path d="M66.5 49 L71 47" />
        </g>
      )
    case 'sunglasses':
      return (
        <g>
          <rect x={32} y={45} width={15} height={10} rx={3} fill="#1f2937" />
          <rect x={53} y={45} width={15} height={10} rx={3} fill="#1f2937" />
          <path d="M47 47 L53 47" stroke="#1f2937" strokeWidth={2} />
          <path d="M32 48 L28 47" stroke="#1f2937" strokeWidth={1.6} />
          <path d="M68 48 L72 47" stroke="#1f2937" strokeWidth={1.6} />
        </g>
      )
    case 'none':
    default:
      return null
  }
}

/**
 * Avatar de personaje vectorial. Determinista: el mismo `config` produce siempre
 * el mismo SVG. Sin dependencias externas.
 */
export const CharacterAvatar = React.memo(function CharacterAvatar({
  config,
  size = 96,
  className,
  withBackground = true,
  title,
}: CharacterAvatarProps) {
  const c = React.useMemo<AvatarCharacterConfig>(
    () => (config ? normalizeCharacter({ ...DEFAULT_CHARACTER, ...config }) : { ...DEFAULT_CHARACTER }),
    [config]
  )

  const skinShade = darken(c.skinTone, 0.12)

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={cn('block', className)}
      role="img"
      aria-label={title ?? 'Avatar personalizado'}
    >
      {withBackground && <rect x={0} y={0} width={100} height={100} fill={c.background} />}

      {/* Cabello posterior (volumen / cabello largo) */}
      <BackHair style={c.hairStyle} color={c.hairColor} />

      {/* Cuello y orejas */}
      <rect x={43} y={70} width={14} height={16} rx={4} fill={skinShade} />
      <circle cx={27} cy={53} r={5.5} fill={c.skinTone} />
      <circle cx={73} cy={53} r={5.5} fill={c.skinTone} />

      {/* Rostro */}
      <ellipse cx={50} cy={52} rx={23} ry={27} fill={c.skinTone} />
      <ellipse cx={50} cy={52} rx={23} ry={27} fill="none" stroke={skinShade} strokeWidth={0.6} opacity={0.5} />

      {/* Cabello superior / flequillo */}
      <TopHair style={c.hairStyle} color={c.hairColor} />

      {/* Cejas, ojos, nariz, boca */}
      <Eyebrows style={c.eyebrowStyle} color={c.hairColor} />
      <Eyes style={c.eyeStyle} color={c.eyeColor} />
      <path d="M49 54 Q47 59 50.5 59.5" stroke={skinShade} strokeWidth={1.4} strokeLinecap="round" fill="none" />
      <Mouth style={c.mouth} />

      {/* Vello facial y accesorios encima */}
      <FacialHair style={c.facialHair} color={c.hairColor} />
      <Accessory style={c.accessory} />
    </svg>
  )
})

export default CharacterAvatar
