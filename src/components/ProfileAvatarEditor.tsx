import * as React from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOptGroup, NativeSelectOption } from '@/components/ui/native-select'
import { Spinner } from '@/components/ui/spinner'
import { CharacterAvatar } from '@/components/CharacterAvatar'
import { getDefaultApiBase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { Eye, Glasses, Image as ImageIcon, Lock, Palette, Scissors, Shuffle, Smile, Sparkles, Upload, UserRound } from 'lucide-react'
import {
  ACCESSORY_OPTIONS,
  BACKGROUND_COLORS,
  DEFAULT_AVATAR,
  DEFAULT_CHARACTER,
  EYE_COLORS,
  EYE_STYLE_OPTIONS,
  EYEBROW_STYLE_OPTIONS,
  FACIAL_HAIR_OPTIONS,
  HAIR_COLORS,
  HAIR_STYLE_GROUPS,
  MOUTH_OPTIONS,
  SKIN_TONES,
  normalizeAvatar,
  normalizeCharacter,
  randomCharacter,
} from '@/lib/avatar'
import type { AvatarCharacterConfig, AvatarData, AvatarMode, HairStyle } from '@/lib/avatar'

interface ProfileAvatarEditorProps {
  value: AvatarData | null
  displayName: string
  canCustomize: boolean
  /** Permiso granular para subir/usar una imagen como avatar. Si es falso, solo
   *  se ofrece el creador de personaje (la pestaña "Imagen" queda oculta). */
  canUploadImage?: boolean
  saving?: boolean
  onSave: (avatar: AvatarData) => Promise<void> | void
}

/* ─── Subcomponentes de control ─── */

function Section({
  title,
  icon,
  children,
  className,
}: {
  title: string
  icon: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('space-y-3 rounded-xl border bg-card/40 p-3.5', className)}>
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <span className="text-primary">{icon}</span>
        {title}
      </div>
      {children}
    </div>
  )
}

function SwatchRow({
  label,
  colors,
  selected,
  onSelect,
  disabled,
}: {
  label?: string
  colors: string[]
  selected: string
  onSelect: (color: string) => void
  disabled?: boolean
}) {
  return (
    <div className="space-y-1.5">
      {label ? <Label className="text-xs font-medium text-muted-foreground">{label}</Label> : null}
      <div className="flex flex-wrap gap-1.5">
        {colors.map((color) => {
          const active = color.toLowerCase() === (selected || '').toLowerCase()
          return (
            <button
              key={color}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(color)}
              aria-label={`${label ?? 'Color'}: ${color}`}
              aria-pressed={active}
              className={cn(
                'size-7 rounded-full border transition-transform duration-150 disabled:cursor-not-allowed disabled:opacity-50',
                active
                  ? 'border-foreground ring-2 ring-primary/60 ring-offset-1 ring-offset-background scale-110'
                  : 'border-border hover:scale-110'
              )}
              style={{ backgroundColor: color }}
            />
          )
        })}
      </div>
    </div>
  )
}

function SelectRow<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label?: string
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
  disabled?: boolean
}) {
  return (
    <div className="space-y-1.5">
      {label ? <Label className="text-xs font-medium text-muted-foreground">{label}</Label> : null}
      <NativeSelect
        className="w-full"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as T)}
      >
        {options.map((option) => (
          <NativeSelectOption key={option.value} value={option.value}>
            {option.label}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </div>
  )
}

function HairStyleSelect({
  value,
  onChange,
  disabled,
}: {
  value: HairStyle
  onChange: (value: HairStyle) => void
  disabled?: boolean
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">Estilo de cabello</Label>
      <NativeSelect
        className="w-full"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as HairStyle)}
      >
        {HAIR_STYLE_GROUPS.map((group) => (
          <NativeSelectOptGroup key={group.label} label={group.label}>
            {group.options.map((option) => (
              <NativeSelectOption key={option.value} value={option.value}>
                {option.label}
              </NativeSelectOption>
            ))}
          </NativeSelectOptGroup>
        ))}
      </NativeSelect>
    </div>
  )
}

export function ProfileAvatarEditor({
  value,
  displayName,
  canCustomize,
  canUploadImage = false,
  saving = false,
  onSave,
}: ProfileAvatarEditorProps) {
  const initial = React.useMemo(() => normalizeAvatar(value) ?? { ...DEFAULT_AVATAR }, [value])

  const [mode, setMode] = React.useState<AvatarMode>(canUploadImage ? initial.mode : 'character')
  const [character, setCharacter] = React.useState<AvatarCharacterConfig>(
    () => initial.character ?? { ...DEFAULT_CHARACTER }
  )
  const [imageUrl, setImageUrl] = React.useState<string | null>(initial.imageUrl ?? null)
  const [uploading, setUploading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [localSaving, setLocalSaving] = React.useState(false)
  const seedRef = React.useRef(1)
  const fileInputRef = React.useRef<HTMLInputElement | null>(null)

  // Reinicia el estado interno cuando cambia el avatar de origen (otro usuario / recarga).
  React.useEffect(() => {
    const next = normalizeAvatar(value) ?? { ...DEFAULT_AVATAR }
    setMode(canUploadImage ? next.mode : 'character')
    setCharacter(next.character ?? { ...DEFAULT_CHARACTER })
    setImageUrl(next.imageUrl ?? null)
    setError(null)
  }, [value, canUploadImage])

  const patchCharacter = (patch: Partial<AvatarCharacterConfig>) => {
    setCharacter((prev) => normalizeCharacter({ ...prev, ...patch }))
  }

  const handleRandomize = () => {
    seedRef.current += 7919
    setCharacter(randomCharacter(seedRef.current))
  }

  const handleReset = () => setCharacter({ ...DEFAULT_CHARACTER })

  const handleUpload = async (file: File) => {
    setError(null)
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const response = await fetch(`${getDefaultApiBase()}/upload`, {
        method: 'POST',
        body: formData,
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok || !payload?.url) {
        const message = typeof payload?.error === 'string' ? payload.error : 'No se pudo subir la imagen.'
        throw new Error(message)
      }
      setImageUrl(String(payload.url))
      setMode('image')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo subir la imagen.')
    } finally {
      setUploading(false)
    }
  }

  const handleSave = async () => {
    setError(null)
    // Sin permiso de imagen, siempre se guarda el personaje (la pestaña está oculta).
    const effectiveMode: AvatarMode = canUploadImage ? mode : 'character'
    if (effectiveMode === 'image' && !imageUrl) {
      setError('Sube una imagen o elige el personaje antes de guardar.')
      return
    }
    const avatar: AvatarData = {
      mode: effectiveMode,
      imageUrl: imageUrl ?? null,
      character,
    }
    setLocalSaving(true)
    try {
      await onSave(avatar)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el avatar.')
    } finally {
      setLocalSaving(false)
    }
  }

  const busy = saving || localSaving || uploading

  return (
    <div className="space-y-4">
      {/* Vista previa grande */}
      <div className="flex flex-col items-center gap-3 rounded-2xl border bg-gradient-to-b from-muted/60 to-muted/20 px-4 py-5 text-center sm:flex-row sm:items-center sm:gap-5 sm:text-left">
        <div className="size-32 shrink-0 overflow-hidden rounded-full border-2 border-border bg-muted shadow-md ring-4 ring-background">
          {mode === 'image' && imageUrl ? (
            <img src={imageUrl} alt={displayName} className="size-full object-cover" />
          ) : (
            <CharacterAvatar config={character} size={128} title={`Avatar de ${displayName}`} />
          )}
        </div>
        <div className="min-w-0 space-y-1.5">
          <p className="text-base font-semibold text-foreground">{displayName}</p>
          <p className="text-xs text-muted-foreground">
            {canCustomize
              ? canUploadImage
                ? 'Diseña tu personaje o sube una foto. El avatar se actualiza al instante; recuerda guardar los cambios.'
                : 'Diseña tu personaje. El avatar se actualiza al instante; recuerda guardar los cambios.'
              : 'No tienes permiso para personalizar el avatar. Pídeselo a un administrador.'}
          </p>
          {canCustomize ? (
            <div className="flex flex-wrap justify-center gap-2 pt-1 sm:justify-start">
              <Button type="button" variant="outline" size="sm" onClick={handleRandomize} disabled={busy}>
                <Shuffle className="size-4" />
                Sorpréndeme
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={handleReset} disabled={busy}>
                Restablecer
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      {!canCustomize ? (
        <div className="flex items-center gap-2 rounded-lg border border-dashed bg-muted/40 px-3 py-3 text-sm text-muted-foreground">
          <Lock className="size-4 shrink-0" />
          <span>
            La personalización del avatar está restringida. El permiso{' '}
            <span className="font-medium text-foreground">Personalizar avatar de perfil</span> debe ser
            concedido en Gestión de Permisos.
          </span>
        </div>
      ) : (
        <Tabs value={mode} onValueChange={(v) => setMode(v as AvatarMode)}>
          {/* La pestaña "Imagen" solo se muestra a quien tiene el permiso
              `upload_avatar_image`; el resto solo ve el creador de personaje. */}
          {canUploadImage ? (
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="character">
                <UserRound className="size-4" />
                Personaje
              </TabsTrigger>
              <TabsTrigger value="image">
                <Upload className="size-4" />
                Imagen
              </TabsTrigger>
            </TabsList>
          ) : null}

          {/* ── Personaje ── */}
          <TabsContent value="character" className="pt-3">
            <div className="grid gap-3 sm:grid-cols-2">
              {/* Cabello (sección destacada a ancho completo) */}
              <Section title="Cabello" icon={<Scissors className="size-4" />} className="sm:col-span-2">
                <div className="grid gap-3 sm:grid-cols-2">
                  <HairStyleSelect
                    value={character.hairStyle}
                    onChange={(v) => patchCharacter({ hairStyle: v })}
                    disabled={busy}
                  />
                  <SwatchRow
                    label="Color de cabello"
                    colors={HAIR_COLORS}
                    selected={character.hairColor}
                    onSelect={(color) => patchCharacter({ hairColor: color })}
                    disabled={busy}
                  />
                </div>
              </Section>

              {/* Piel */}
              <Section title="Color de piel" icon={<Palette className="size-4" />}>
                <SwatchRow
                  colors={SKIN_TONES}
                  selected={character.skinTone}
                  onSelect={(color) => patchCharacter({ skinTone: color })}
                  disabled={busy}
                />
              </Section>

              {/* Fondo */}
              <Section title="Fondo" icon={<ImageIcon className="size-4" />}>
                <SwatchRow
                  colors={BACKGROUND_COLORS}
                  selected={character.background}
                  onSelect={(color) => patchCharacter({ background: color })}
                  disabled={busy}
                />
              </Section>

              {/* Ojos */}
              <Section title="Ojos" icon={<Eye className="size-4" />}>
                <SwatchRow
                  label="Color de ojos"
                  colors={EYE_COLORS}
                  selected={character.eyeColor}
                  onSelect={(color) => patchCharacter({ eyeColor: color })}
                  disabled={busy}
                />
                <SelectRow
                  label="Forma de ojos"
                  value={character.eyeStyle}
                  options={EYE_STYLE_OPTIONS}
                  onChange={(v) => patchCharacter({ eyeStyle: v })}
                  disabled={busy}
                />
              </Section>

              {/* Cejas */}
              <Section title="Cejas" icon={<UserRound className="size-4" />}>
                <SelectRow
                  label="Estilo de cejas"
                  value={character.eyebrowStyle}
                  options={EYEBROW_STYLE_OPTIONS}
                  onChange={(v) => patchCharacter({ eyebrowStyle: v })}
                  disabled={busy}
                />
              </Section>

              {/* Boca */}
              <Section title="Boca" icon={<Smile className="size-4" />}>
                <SelectRow
                  label="Expresión"
                  value={character.mouth}
                  options={MOUTH_OPTIONS}
                  onChange={(v) => patchCharacter({ mouth: v })}
                  disabled={busy}
                />
              </Section>

              {/* Vello facial */}
              <Section title="Vello facial" icon={<UserRound className="size-4" />}>
                <SelectRow
                  label="Estilo"
                  value={character.facialHair}
                  options={FACIAL_HAIR_OPTIONS}
                  onChange={(v) => patchCharacter({ facialHair: v })}
                  disabled={busy}
                />
              </Section>

              {/* Accesorios */}
              <Section title="Accesorios" icon={<Glasses className="size-4" />}>
                <SelectRow
                  label="Gafas"
                  value={character.accessory}
                  options={ACCESSORY_OPTIONS}
                  onChange={(v) => patchCharacter({ accessory: v })}
                  disabled={busy}
                />
              </Section>
            </div>
          </TabsContent>

          {/* ── Imagen (solo con permiso `upload_avatar_image`) ── */}
          {canUploadImage ? (
          <TabsContent value="image" className="space-y-3 pt-3">
            <div className="rounded-lg border border-dashed bg-muted/30 px-4 py-6 text-center">
              <Sparkles className="mx-auto mb-2 size-5 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Sube una foto (JPG, PNG o WEBP). Se usará como tu avatar de perfil.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) void handleUpload(file)
                  e.target.value = ''
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-3"
                disabled={busy}
                onClick={() => fileInputRef.current?.click()}
              >
                {uploading ? <Spinner className="size-4" /> : <Upload className="size-4" />}
                {uploading ? 'Subiendo…' : imageUrl ? 'Cambiar imagen' : 'Subir imagen'}
              </Button>
              {imageUrl ? (
                <div className="mt-3">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setMode('character')}
                    className="text-xs font-medium text-primary hover:underline disabled:opacity-50"
                  >
                    Usar personaje en su lugar
                  </button>
                </div>
              ) : null}
            </div>
          </TabsContent>
          ) : null}
        </Tabs>
      )}

      {error ? (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
      ) : null}

      {canCustomize ? (
        <div className="flex justify-end">
          <Button type="button" onClick={handleSave} disabled={busy}>
            {busy ? <Spinner className="size-4" /> : null}
            {busy ? 'Guardando…' : 'Guardar avatar'}
          </Button>
        </div>
      ) : null}
    </div>
  )
}

export default ProfileAvatarEditor
