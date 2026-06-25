/**
 * Modelo de datos y utilidades para el avatar de perfil.
 *
 * Un avatar puede ser de dos tipos:
 *  - `image`: una foto subida por el usuario (se guarda solo la URL pública).
 *  - `character`: un personaje vectorial configurable (color de piel, ojos,
 *    cejas, cabello, vello facial, boca, accesorios y fondo).
 *
 * La personalización está protegida por el permiso `customize_avatar`
 * (módulo "Perfil"), que se concede desde Gestión de Permisos.
 */

export type AvatarMode = 'character' | 'image'

export type HairStyle =
  | 'none'
  | 'buzz'
  | 'fade'
  | 'undercut'
  | 'short'
  | 'spiky'
  | 'pompadour'
  | 'medium'
  | 'wavy'
  | 'bob'
  | 'curly'
  | 'afro'
  | 'long'
  | 'ponytail'
  | 'bun'
  | 'braids'
  | 'mohawk'
export type EyebrowStyle = 'default' | 'raised' | 'serious' | 'worried'
export type EyeStyle = 'default' | 'round' | 'sleepy' | 'wink'
export type FacialHair = 'none' | 'stubble' | 'mustache' | 'goatee' | 'beard'
export type MouthStyle = 'smile' | 'neutral' | 'grin' | 'open' | 'smirk'
export type AccessoryStyle = 'none' | 'glasses' | 'round-glasses' | 'sunglasses'

export interface AvatarCharacterConfig {
  skinTone: string
  hairStyle: HairStyle
  hairColor: string
  eyeColor: string
  eyeStyle: EyeStyle
  eyebrowStyle: EyebrowStyle
  facialHair: FacialHair
  mouth: MouthStyle
  accessory: AccessoryStyle
  background: string
}

export interface AvatarData {
  mode: AvatarMode
  imageUrl?: string | null
  character?: AvatarCharacterConfig
}

/* ──────────────────────────────  Paletas  ────────────────────────────── */

export const SKIN_TONES: string[] = [
  '#ffe8d6', '#ffe0bd', '#ffcd94', '#f1c27d', '#e0ac69', '#cf9b6b',
  '#c68642', '#a56c42', '#8d5524', '#6b4423', '#5c3a21', '#3d2817',
]

export const HAIR_COLORS: string[] = [
  '#0d0d0d', '#1a1a1a', '#2c1b18', '#3a2a22', '#4a312c', '#6f4e37',
  '#7a3b2e', '#a55728', '#c68642', '#d6b370', '#e6cea8', '#f5f0e6',
  '#9a9a9a', '#cfcfcf', '#ededed', '#8b3a62', '#e85d9c', '#5b51c9',
  '#2f7dd1', '#1fb6a6', '#2f9e6f', '#e2402f',
]

export const EYE_COLORS: string[] = [
  '#3b2415', '#5b3a1e', '#7b4b2a', '#b5651d', '#8a6d3b',
  '#3f7d4f', '#2f9e6f', '#3b6ea5', '#6fb1e0', '#6b7280',
  '#7c5cbf', '#1f2937',
]

export const BACKGROUND_COLORS: string[] = [
  '#e0f2fe', '#dbeafe', '#ede9fe', '#fae8ff', '#fce7f3', '#dcfce7',
  '#d1fae5', '#fef9c3', '#ffedd5', '#cffafe', '#e2e8f0', '#fee2e2',
  '#334155', '#1e293b',
]

/* ────────────────────────  Opciones para selectores  ───────────────────── */

/** Peinados agrupados por categoría (para listas desplegables con optgroup). */
export const HAIR_STYLE_GROUPS: { label: string; options: { value: HairStyle; label: string }[] }[] = [
  {
    label: 'Sin cabello',
    options: [{ value: 'none', label: 'Calvo / sin cabello' }],
  },
  {
    label: 'Cortos',
    options: [
      { value: 'buzz', label: 'Rapado (buzz cut)' },
      { value: 'fade', label: 'Degradado (fade)' },
      { value: 'undercut', label: 'Undercut' },
      { value: 'short', label: 'Corto clásico' },
      { value: 'spiky', label: 'En puntas' },
      { value: 'pompadour', label: 'Pompadour' },
    ],
  },
  {
    label: 'Medios',
    options: [
      { value: 'medium', label: 'Medio' },
      { value: 'wavy', label: 'Ondulado' },
      { value: 'bob', label: 'Media melena (bob)' },
      { value: 'curly', label: 'Rizado' },
      { value: 'afro', label: 'Afro' },
    ],
  },
  {
    label: 'Largos y recogidos',
    options: [
      { value: 'long', label: 'Largo' },
      { value: 'ponytail', label: 'Coleta' },
      { value: 'bun', label: 'Moño / recogido' },
      { value: 'braids', label: 'Trenzas' },
    ],
  },
  {
    label: 'Especiales',
    options: [{ value: 'mohawk', label: 'Cresta (mohawk)' }],
  },
]

export const HAIR_STYLE_OPTIONS: { value: HairStyle; label: string }[] = HAIR_STYLE_GROUPS.flatMap(
  (group) => group.options
)

export const EYE_STYLE_OPTIONS: { value: EyeStyle; label: string }[] = [
  { value: 'default', label: 'Normales' },
  { value: 'round', label: 'Grandes' },
  { value: 'sleepy', label: 'Adormilados' },
  { value: 'wink', label: 'Guiño' },
]

export const EYEBROW_STYLE_OPTIONS: { value: EyebrowStyle; label: string }[] = [
  { value: 'default', label: 'Naturales' },
  { value: 'raised', label: 'Levantadas' },
  { value: 'serious', label: 'Serias' },
  { value: 'worried', label: 'Preocupadas' },
]

export const FACIAL_HAIR_OPTIONS: { value: FacialHair; label: string }[] = [
  { value: 'none', label: 'Sin vello' },
  { value: 'stubble', label: 'Incipiente' },
  { value: 'mustache', label: 'Bigote' },
  { value: 'goatee', label: 'Perilla' },
  { value: 'beard', label: 'Barba' },
]

export const MOUTH_OPTIONS: { value: MouthStyle; label: string }[] = [
  { value: 'smile', label: 'Sonrisa' },
  { value: 'neutral', label: 'Neutral' },
  { value: 'grin', label: 'Amplia' },
  { value: 'open', label: 'Abierta' },
  { value: 'smirk', label: 'Ladeada' },
]

export const ACCESSORY_OPTIONS: { value: AccessoryStyle; label: string }[] = [
  { value: 'none', label: 'Ninguno' },
  { value: 'glasses', label: 'Gafas' },
  { value: 'round-glasses', label: 'Gafas redondas' },
  { value: 'sunglasses', label: 'Gafas de sol' },
]

/* ──────────────────────────────  Defaults  ───────────────────────────── */

export const DEFAULT_CHARACTER: AvatarCharacterConfig = {
  skinTone: SKIN_TONES[4],
  hairStyle: 'short',
  hairColor: HAIR_COLORS[2],
  eyeColor: EYE_COLORS[1],
  eyeStyle: 'default',
  eyebrowStyle: 'default',
  facialHair: 'none',
  mouth: 'smile',
  accessory: 'none',
  background: BACKGROUND_COLORS[0],
}

export const DEFAULT_AVATAR: AvatarData = {
  mode: 'character',
  imageUrl: null,
  character: { ...DEFAULT_CHARACTER },
}

/* ──────────────────────────────  Helpers  ────────────────────────────── */

const HAIR_STYLE_VALUES = new Set(HAIR_STYLE_OPTIONS.map((o) => o.value))
const EYE_STYLE_VALUES = new Set(EYE_STYLE_OPTIONS.map((o) => o.value))
const EYEBROW_STYLE_VALUES = new Set(EYEBROW_STYLE_OPTIONS.map((o) => o.value))
const FACIAL_HAIR_VALUES = new Set(FACIAL_HAIR_OPTIONS.map((o) => o.value))
const MOUTH_VALUES = new Set(MOUTH_OPTIONS.map((o) => o.value))
const ACCESSORY_VALUES = new Set(ACCESSORY_OPTIONS.map((o) => o.value))

function pickColor(value: unknown, _palette: string[], fallback: string): string {
  if (typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value.trim())) {
    return value.trim().toLowerCase()
  }
  return fallback
}

/**
 * Normaliza una configuración de personaje arbitraria (por ejemplo recibida del
 * backend) hacia una estructura válida, rellenando con los valores por defecto.
 */
export function normalizeCharacter(raw: unknown): AvatarCharacterConfig {
  const value = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>

  const hairStyle = value.hairStyle as HairStyle
  const eyeStyle = value.eyeStyle as EyeStyle
  const eyebrowStyle = value.eyebrowStyle as EyebrowStyle
  const facialHair = value.facialHair as FacialHair
  const mouth = value.mouth as MouthStyle
  const accessory = value.accessory as AccessoryStyle

  return {
    skinTone: pickColor(value.skinTone, SKIN_TONES, DEFAULT_CHARACTER.skinTone),
    hairStyle: HAIR_STYLE_VALUES.has(hairStyle) ? hairStyle : DEFAULT_CHARACTER.hairStyle,
    hairColor: pickColor(value.hairColor, HAIR_COLORS, DEFAULT_CHARACTER.hairColor),
    eyeColor: pickColor(value.eyeColor, EYE_COLORS, DEFAULT_CHARACTER.eyeColor),
    eyeStyle: EYE_STYLE_VALUES.has(eyeStyle) ? eyeStyle : DEFAULT_CHARACTER.eyeStyle,
    eyebrowStyle: EYEBROW_STYLE_VALUES.has(eyebrowStyle) ? eyebrowStyle : DEFAULT_CHARACTER.eyebrowStyle,
    facialHair: FACIAL_HAIR_VALUES.has(facialHair) ? facialHair : DEFAULT_CHARACTER.facialHair,
    mouth: MOUTH_VALUES.has(mouth) ? mouth : DEFAULT_CHARACTER.mouth,
    accessory: ACCESSORY_VALUES.has(accessory) ? accessory : DEFAULT_CHARACTER.accessory,
    background: pickColor(value.background, BACKGROUND_COLORS, DEFAULT_CHARACTER.background),
  }
}

/**
 * Normaliza el avatar completo desde un valor arbitrario. Devuelve `null` cuando
 * no hay datos utilizables (para usar el fallback de iniciales).
 */
export function normalizeAvatar(raw: unknown): AvatarData | null {
  if (!raw || typeof raw !== 'object') {
    return null
  }

  const value = raw as Record<string, unknown>
  const mode: AvatarMode = value.mode === 'image' ? 'image' : 'character'

  if (mode === 'image') {
    const imageUrl = typeof value.imageUrl === 'string' && value.imageUrl.trim() ? value.imageUrl.trim() : null
    if (!imageUrl) {
      // Una imagen sin URL no sirve: si hay personaje, lo usamos; si no, null.
      return value.character ? { mode: 'character', character: normalizeCharacter(value.character) } : null
    }
    return {
      mode: 'image',
      imageUrl,
      character: value.character ? normalizeCharacter(value.character) : { ...DEFAULT_CHARACTER },
    }
  }

  return {
    mode: 'character',
    imageUrl: typeof value.imageUrl === 'string' ? value.imageUrl : null,
    character: normalizeCharacter(value.character),
  }
}

/** Devuelve la URL de imagen solo cuando el avatar está en modo imagen. */
export function getAvatarImageUrl(avatar: AvatarData | null | undefined): string | undefined {
  if (avatar?.mode === 'image' && avatar.imageUrl) {
    return avatar.imageUrl
  }
  return undefined
}

/** Genera una configuración de personaje aleatoria (para el botón "Sorpréndeme"). */
export function randomCharacter(seed: number): AvatarCharacterConfig {
  // PRNG determinista simple basado en la semilla para no depender de Math.random.
  let state = Math.abs(Math.floor(seed)) % 2147483647 || 1
  const next = () => {
    state = (state * 16807) % 2147483647
    return state / 2147483647
  }
  const pick = <T,>(arr: T[]): T => arr[Math.floor(next() * arr.length)]

  return {
    skinTone: pick(SKIN_TONES),
    hairStyle: pick(HAIR_STYLE_OPTIONS).value,
    hairColor: pick(HAIR_COLORS),
    eyeColor: pick(EYE_COLORS),
    eyeStyle: pick(EYE_STYLE_OPTIONS).value,
    eyebrowStyle: pick(EYEBROW_STYLE_OPTIONS).value,
    facialHair: pick(FACIAL_HAIR_OPTIONS).value,
    mouth: pick(MOUTH_OPTIONS).value,
    accessory: pick(ACCESSORY_OPTIONS).value,
    background: pick(BACKGROUND_COLORS),
  }
}

/** Oscurece un color hex un porcentaje dado (0-1). Útil para sombras/contornos. */
export function darken(hex: string, amount = 0.2): string {
  const normalized = hex.replace('#', '')
  if (normalized.length !== 6) return hex
  const num = parseInt(normalized, 16)
  const r = Math.max(0, Math.round(((num >> 16) & 0xff) * (1 - amount)))
  const g = Math.max(0, Math.round(((num >> 8) & 0xff) * (1 - amount)))
  const b = Math.max(0, Math.round((num & 0xff) * (1 - amount)))
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}

/** Aclara un color hex un porcentaje dado (0-1), mezclándolo hacia el blanco. */
export function lighten(hex: string, amount = 0.2): string {
  const normalized = hex.replace('#', '')
  if (normalized.length !== 6) return hex
  const num = parseInt(normalized, 16)
  const r = Math.min(255, Math.round(((num >> 16) & 0xff) + (255 - ((num >> 16) & 0xff)) * amount))
  const g = Math.min(255, Math.round(((num >> 8) & 0xff) + (255 - ((num >> 8) & 0xff)) * amount))
  const b = Math.min(255, Math.round((num & 0xff) + (255 - (num & 0xff)) * amount))
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}
