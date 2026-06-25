import * as React from 'react'
import type { AvatarCharacterConfig } from '@/lib/avatar'
import { DEFAULT_CHARACTER, darken, lighten, normalizeCharacter } from '@/lib/avatar'
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

/* ─────────────────────────────  Cabello  ─────────────────────────────
 * El cabello se construye sobre una "tapa" que abraza el cráneo: cubre la
 * corona y baja por los lados hasta las patillas, con una línea de cabello
 * natural en la frente. Así nunca parece una pieza flotante ni rapada por
 * debajo. Cada estilo añade volumen, capas y textura sobre esa base.
 *
 *   t  = y de la corona (menor = más alto / más volumen)
 *   s  = ensanche lateral más allá del cráneo (volumen a los lados)
 *   f  = y de la línea del cabello en la frente
 *   sb = y hasta donde baja el cabello por los lados (mayor = más largo)
 */
function capPath(t: number, s: number, f: number, sb: number): string {
  const lx = 27 - s
  const rx = 73 + s
  return [
    `M ${lx} ${sb}`,
    `C ${lx} ${t + 14}, 32 ${t}, 50 ${t}`,
    `C 68 ${t}, ${rx} ${t + 14}, ${rx} ${sb}`,
    `C ${rx - 2} ${sb - 4}, 65 ${f + 2}, 60 ${f + 1}`,
    `C 56 ${f + 1.5}, 53 ${f + 2}, 50 ${f + 2}`,
    `C 47 ${f + 2}, 44 ${f + 1.5}, 40 ${f + 1}`,
    `C 35 ${f + 2}, ${lx + 2} ${sb - 4}, ${lx} ${sb}`,
    'Z',
  ].join(' ')
}

/** Brillo suave de la corona (luz arriba-izquierda) para dar volumen. */
function CrownSheen({ t, light }: { t: number; light: string }) {
  return (
    <ellipse
      cx={43}
      cy={t + 6}
      rx={11}
      ry={5}
      fill={light}
      opacity={0.32}
      transform={`rotate(-18 43 ${t + 6})`}
    />
  )
}

/** Tapa base que abraza el cráneo, con contorno de raíz y brillo de corona. */
function Cap({
  t,
  s,
  f,
  sb,
  fill,
  root,
  light,
  sheen = true,
  opacity = 1,
}: {
  t: number
  s: number
  f: number
  sb: number
  fill: string
  root: string
  light: string
  sheen?: boolean
  opacity?: number
}) {
  const d = capPath(t, s, f, sb)
  return (
    <>
      <path d={d} fill={fill} opacity={opacity} />
      <path d={d} fill="none" stroke={root} strokeWidth={0.6} opacity={0.5} />
      {sheen && <CrownSheen t={t} light={light} />}
    </>
  )
}

interface HairParts {
  back: React.ReactNode
  front: React.ReactNode
}

/** Construye las dos capas del cabello: `back` (detrás de la cabeza) y `front`. */
function buildHair(style: AvatarCharacterConfig['hairStyle'], color: string, gradId: string): HairParts {
  const root = darken(color, 0.22)
  const mid = color
  const light = lighten(color, 0.28)
  const fill = `url(#${gradId})`
  const capProps = { fill, root, light }

  switch (style) {
    case 'none':
      return { back: null, front: null }

    case 'buzz':
      return {
        back: null,
        front: (
          <>
            <path d={capPath(24, 0.3, 39, 48)} fill={fill} opacity={0.92} />
            <path d={capPath(24, 0.3, 39, 48)} fill="none" stroke={root} strokeWidth={0.5} opacity={0.45} />
          </>
        ),
      }

    case 'fade':
      return {
        back: null,
        front: (
          <>
            <Cap t={21} s={0.8} f={38} sb={45} {...capProps} />
            <path d="M27 46 Q26 52 29 55 Q31 50 31 46 Z" fill={mid} opacity={0.3} />
            <path d="M73 46 Q74 52 71 55 Q69 50 69 46 Z" fill={mid} opacity={0.3} />
          </>
        ),
      }

    case 'undercut':
      return {
        back: null,
        front: (
          <>
            <Cap t={18} s={0.8} f={37} sb={44} {...capProps} />
            <path d="M33 36 Q48 30 67 34" fill="none" stroke={root} strokeWidth={0.8} opacity={0.4} />
            <path d="M33 40 Q48 34 66 38" fill="none" stroke={root} strokeWidth={0.8} opacity={0.35} />
            <path d="M36 31 Q50 27 62 31" fill="none" stroke={light} strokeWidth={1} opacity={0.45} />
          </>
        ),
      }

    case 'short':
      return {
        back: null,
        front: (
          <>
            <Cap t={21} s={1.6} f={38} sb={51} {...capProps} />
            <path d="M40 36 Q52 31 66 37" fill="none" stroke={root} strokeWidth={0.7} opacity={0.4} />
          </>
        ),
      }

    case 'spiky': {
      const spikes = [30, 37, 44, 50, 56, 63, 70].map((x, i) => {
        const h = i % 2 === 0 ? 12 : 17
        return <path key={x} d={`M${x - 5} 30 L${x} ${30 - h} L${x + 5} 30 Z`} fill={fill} />
      })
      return {
        back: null,
        front: (
          <>
            <path d={capPath(26, 1.2, 38, 49)} fill={fill} />
            {spikes}
            <CrownSheen t={24} light={light} />
          </>
        ),
      }
    }

    case 'pompadour':
      return {
        back: null,
        front: (
          <>
            <Cap t={22} s={0.8} f={38} sb={47} {...capProps} />
            <path d="M29 42 Q30 18 51 17 Q71 18 71 40 Q66 31 56 30 Q44 29 36 33 Q31 36 29 42 Z" fill={fill} />
            <path d="M35 34 Q42 21 52 21 Q62 22 66 33 Q58 27 50 28 Q42 29 35 34 Z" fill={light} opacity={0.4} />
          </>
        ),
      }

    case 'medium':
      return {
        back: (
          <>
            <path d="M25 46 Q22 66 28 74 Q31 60 31 50 Z" fill={root} opacity={0.85} />
            <path d="M75 46 Q78 66 72 74 Q69 60 69 50 Z" fill={root} opacity={0.85} />
          </>
        ),
        front: (
          <>
            <Cap t={20} s={2.4} f={37} sb={56} {...capProps} />
            <path d="M27 54 Q27 64 31 68 Q31 60 31 54 Z" fill={fill} />
            <path d="M73 54 Q73 64 69 68 Q69 60 69 54 Z" fill={fill} />
          </>
        ),
      }

    case 'wavy':
      return {
        back: null,
        front: (
          <>
            <Cap t={20} s={2.2} f={37} sb={55} {...capProps} />
            <path d="M28 50 Q31 54 34 50 Q37 54 40 50" fill="none" stroke={root} strokeWidth={0.7} opacity={0.4} />
            <path d="M60 50 Q63 54 66 50 Q69 54 72 50" fill="none" stroke={root} strokeWidth={0.7} opacity={0.4} />
            <path d="M36 34 Q44 38 52 34 Q60 38 66 34" fill="none" stroke={light} strokeWidth={1} opacity={0.5} />
          </>
        ),
      }

    case 'bob':
      return {
        back: (
          <path
            d="M24 46 Q20 70 30 76 Q28 60 31 52 Q26 44 31 40 Q40 33 50 33 Q60 33 69 40 Q74 44 69 52 Q72 60 70 76 Q80 70 76 46 Q76 27 50 27 Q24 27 24 46 Z"
            fill={fill}
          />
        ),
        front: (
          <>
            <Cap t={20} s={2} f={36} sb={56} {...capProps} />
            <path d="M27 52 Q25 66 31 70 Q31 60 31 52 Z" fill={fill} />
            <path d="M73 52 Q75 66 69 70 Q69 60 69 52 Z" fill={fill} />
            <path d="M33 38 Q42 33 50 34 Q58 33 67 38 Q60 42 50 41 Q40 42 33 38 Z" fill={fill} />
          </>
        ),
      }

    case 'curly': {
      const curls = [
        [30, 40, 7], [40, 31, 7.5], [50, 28, 8], [60, 31, 7.5], [70, 40, 7],
        [34, 47, 6], [66, 47, 6], [44, 27, 5.5], [56, 27, 5.5], [27, 48, 5.5], [73, 48, 5.5],
      ].map(([cx, cy, r], i) => <circle key={`c${i}`} cx={cx} cy={cy} r={r} fill={fill} />)
      const highlights = [
        [44, 33, 2.4], [54, 33, 2.4], [36, 41, 2], [64, 41, 2],
      ].map(([cx, cy, r], i) => (
        <circle key={`h${i}`} cx={cx} cy={cy} r={r} fill={light} opacity={0.55} />
      ))
      return {
        back: null,
        front: (
          <>
            <path d={capPath(28, 1.5, 39, 50)} fill={fill} />
            {curls}
            {highlights}
          </>
        ),
      }
    }

    case 'afro': {
      const bumps = []
      const M = 14
      const cx0 = 50
      const cy0 = 31
      const rx = 29
      const ry = 25
      for (let i = 0; i <= M; i++) {
        const a = (Math.PI * i) / M
        const cx = cx0 - rx * Math.cos(a)
        const cy = cy0 - ry * Math.sin(a)
        bumps.push(<circle key={`b${i}`} cx={Number(cx.toFixed(1))} cy={Number(cy.toFixed(1))} r={6.5} fill={fill} />)
      }
      return {
        back: null,
        front: (
          <>
            <ellipse cx={cx0} cy={cy0} rx={rx} ry={ry} fill={fill} />
            {bumps}
            <path d={capPath(20, 4, 38, 50)} fill={fill} />
            <ellipse cx={42} cy={24} rx={9} ry={6} fill={light} opacity={0.45} />
          </>
        ),
      }
    }

    case 'long':
      return {
        back: (
          <>
            <path
              d="M22 48 Q16 78 26 88 Q24 70 30 56 Q26 44 30 40 Q40 32 50 32 Q60 32 70 40 Q74 44 70 56 Q76 70 74 88 Q84 78 78 48 Q78 26 50 26 Q22 26 22 48 Z"
              fill={fill}
            />
            <path
              d="M22 48 Q16 78 26 88 Q24 70 30 56 Q26 44 30 40 Q40 32 50 32 Q60 32 70 40 Q74 44 70 56 Q76 70 74 88 Q84 78 78 48 Q78 26 50 26 Q22 26 22 48 Z"
              fill="none"
              stroke={root}
              strokeWidth={0.6}
              opacity={0.4}
            />
          </>
        ),
        front: (
          <>
            <Cap t={19} s={2} f={37} sb={58} {...capProps} />
            <path d="M27 50 Q24 66 28 76 Q31 62 31 52 Z" fill={fill} />
            <path d="M73 50 Q76 66 72 76 Q69 62 69 52 Z" fill={fill} />
            <path d="M44 34 Q50 31 56 34" fill="none" stroke={root} strokeWidth={0.7} opacity={0.4} />
          </>
        ),
      }

    case 'ponytail':
      return {
        back: (
          <>
            <path
              d="M68 36 Q82 44 80 64 Q76 80 70 82 Q74 66 70 54 Q67 44 64 40 Z"
              fill={fill}
            />
            <path
              d="M68 36 Q82 44 80 64 Q76 80 70 82 Q74 66 70 54 Q67 44 64 40 Z"
              fill="none"
              stroke={root}
              strokeWidth={0.6}
              opacity={0.4}
            />
          </>
        ),
        front: (
          <>
            <path d={capPath(19, 1.5, 37, 46)} fill={fill} />
            <path d="M32 34 Q50 28 68 34" fill="none" stroke={root} strokeWidth={0.7} opacity={0.35} />
            <path d="M34 38 Q50 33 66 38" fill="none" stroke={light} strokeWidth={0.8} opacity={0.4} />
            <ellipse cx={68} cy={38} rx={3.2} ry={3.2} fill={root} />
            <CrownSheen t={20} light={light} />
          </>
        ),
      }

    case 'bun':
      return {
        back: (
          <>
            <circle cx={50} cy={19} r={8.5} fill={fill} />
            <circle cx={50} cy={19} r={8.5} fill="none" stroke={root} strokeWidth={0.6} opacity={0.45} />
          </>
        ),
        front: (
          <>
            <path d={capPath(20, 1.3, 37, 46)} fill={fill} />
            <path d="M32 33 Q50 27 68 33" fill="none" stroke={root} strokeWidth={0.7} opacity={0.35} />
            <path d="M35 37 Q50 32 65 37" fill="none" stroke={light} strokeWidth={0.8} opacity={0.4} />
            <path d="M42 27 Q50 23 58 27" fill={root} opacity={0.5} />
            <CrownSheen t={20} light={light} />
          </>
        ),
      }

    case 'braids': {
      const braid = (x: number) => {
        const segs = []
        for (let i = 0; i < 6; i++) {
          const y = 50 + i * 7
          segs.push(<ellipse key={`e${x}-${i}`} cx={x} cy={y} rx={5} ry={4.5} fill={fill} />)
          segs.push(
            <path
              key={`p${x}-${i}`}
              d={`M${x - 5} ${y} Q${x} ${y + 2} ${x + 5} ${y}`}
              fill="none"
              stroke={root}
              strokeWidth={0.7}
              opacity={0.45}
            />
          )
        }
        return segs
      }
      return {
        back: (
          <>
            {braid(25)}
            {braid(75)}
          </>
        ),
        front: (
          <>
            <path d={capPath(20, 1.6, 37, 49)} fill={fill} />
            <path d="M50 30 L50 40" stroke={root} strokeWidth={0.7} opacity={0.4} />
            <CrownSheen t={20} light={light} />
          </>
        ),
      }
    }

    case 'mohawk':
      return {
        back: null,
        front: (
          <>
            <path d={capPath(25, 0.2, 40, 47)} fill={mid} opacity={0.18} />
            <path d="M42 30 Q42 14 50 12 Q58 14 58 30 L58 40 Q50 36 42 40 Z" fill={fill} />
            <path d="M45 28 Q46 17 50 16 Q54 17 55 28 Q50 25 45 28 Z" fill={light} opacity={0.5} />
          </>
        ),
      }

    default:
      return { back: null, front: <Cap t={21} s={1.6} f={38} sb={51} {...capProps} /> }
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

  // Ids únicos por instancia para los gradientes (varios avatares en una misma página).
  const rawId = React.useId().replace(/[^a-zA-Z0-9]/g, '')
  const skinGradId = `skin-${rawId}`
  const hairGradId = `hair-${rawId}`

  const skinLight = lighten(c.skinTone, 0.12)
  const skinShade = darken(c.skinTone, 0.14)
  const hairTop = lighten(c.hairColor, 0.22)
  const hairBottom = darken(c.hairColor, 0.14)

  const hair = React.useMemo(() => buildHair(c.hairStyle, c.hairColor, hairGradId), [c.hairStyle, c.hairColor, hairGradId])

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={cn('block', className)}
      role="img"
      aria-label={title ?? 'Avatar personalizado'}
    >
      <defs>
        <radialGradient id={skinGradId} cx="42%" cy="38%" r="75%">
          <stop offset="0%" stopColor={skinLight} />
          <stop offset="100%" stopColor={c.skinTone} />
        </radialGradient>
        <linearGradient id={hairGradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={hairTop} />
          <stop offset="55%" stopColor={c.hairColor} />
          <stop offset="100%" stopColor={hairBottom} />
        </linearGradient>
      </defs>

      {withBackground && <rect x={0} y={0} width={100} height={100} fill={c.background} />}

      {/* Cabello posterior (volumen / cabello largo) */}
      {hair.back}

      {/* Hombros, cuello y orejas */}
      <path d="M26 100 Q27 82 50 82 Q73 82 74 100 Z" fill={skinShade} />
      <path d="M44 69 L44 79 Q50 83 56 79 L56 69 Z" fill={c.skinTone} />
      <path d="M44 76 Q50 80 56 76 L56 79 Q50 83 44 79 Z" fill={skinShade} opacity={0.6} />
      <ellipse cx={27} cy={53} rx={5.2} ry={6} fill={c.skinTone} />
      <ellipse cx={73} cy={53} rx={5.2} ry={6} fill={c.skinTone} />
      <ellipse cx={27} cy={53} rx={2.4} ry={3} fill={skinShade} opacity={0.5} />
      <ellipse cx={73} cy={53} rx={2.4} ry={3} fill={skinShade} opacity={0.5} />

      {/* Rostro */}
      <ellipse cx={50} cy={52} rx={22.5} ry={27} fill={`url(#${skinGradId})`} />
      <ellipse cx={50} cy={52} rx={22.5} ry={27} fill="none" stroke={skinShade} strokeWidth={0.6} opacity={0.5} />

      {/* Cabello superior / flequillo (sobre el cráneo) */}
      {hair.front}

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
