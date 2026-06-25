import * as React from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Spinner } from '@/components/ui/spinner'
import { CharacterAvatar } from '@/components/CharacterAvatar'
import { getDefaultApiBase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { Lock, Shuffle, Sparkles, Upload, UserRound } from 'lucide-react'
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
  HAIR_STYLE_OPTIONS,
  MOUTH_OPTIONS,
  SKIN_TONES,
  normalizeAvatar,
  normalizeCharacter,
  randomCharacter,
} from '@/lib/avatar'
import type { AvatarCharacterConfig, AvatarData, AvatarMode } from '@/lib/avatar'

interface ProfileAvatarEditorProps {
  value: AvatarData | null
  displayName: string
  canCustomize: boolean
  saving?: boolean
  onSave: (avatar: AvatarData) => Promise<void> | void
}

/* ─── Subcomponentes de control ─── */

function SwatchRow({
  label,
  colors,
  selected,
  onSelect,
  disabled,
}: {
  label: string
  colors: string[]
  selected: string
  onSelect: (color: string) => void
  disabled?: boolean
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      <div className="flex flex-wrap gap-1.5">
        {colors.map((color) => {
          const active = color.toLowerCase() === (selected || '').toLowerCase()
          return (
            <button
              key={color}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(color)}
              aria-label={`${label}: ${color}`}
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
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
  disabled?: boolean
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
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

export function ProfileAvatarEditor({
  value,
  displayName,
  canCustomize,
  saving = false,
  onSave,
}: ProfileAvatarEditorProps) {
  const initial = React.useMemo(() => normalizeAvatar(value) ?? { ...DEFAULT_AVATAR }, [value])

  const [mode, setMode] = React.useState<AvatarMode>(initial.mode)
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
    setMode(next.mode)
    setCharacter(next.character ?? { ...DEFAULT_CHARACTER })
    setImageUrl(next.imageUrl ?? null)
    setError(null)
  }, [value])

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
    if (mode === 'image' && !imageUrl) {
      setError('Sube una imagen o elige el personaje antes de guardar.')
      return
    }
    const avatar: AvatarData = {
      mode,
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
      <div className="flex items-center gap-4">
        <div className="size-24 shrink-0 overflow-hidden rounded-full border-2 border-border bg-muted shadow-sm">
          {mode === 'image' && imageUrl ? (
            <img src={imageUrl} alt={displayName} className="size-full object-cover" />
          ) : (
            <CharacterAvatar config={character} size={96} title={`Avatar de ${displayName}`} />
          )}
        </div>
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-semibold text-foreground">Vista previa</p>
          <p className="text-xs text-muted-foreground">
            {canCustomize
              ? 'Diseña tu personaje o sube una foto. Recuerda guardar los cambios.'
              : 'No tienes permiso para personalizar el avatar. Pídeselo a un administrador.'}
          </p>
          {mode === 'image' && imageUrl ? (
            <button
              type="button"
              disabled={!canCustomize || busy}
              onClick={() => setMode('character')}
              className="text-xs font-medium text-primary hover:underline disabled:opacity-50"
            >
              Usar personaje en su lugar
            </button>
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

          {/* ── Personaje ── */}
          <TabsContent value="character" className="space-y-4 pt-3">
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={handleRandomize} disabled={busy}>
                <Shuffle className="size-4" />
                Sorpréndeme
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={handleReset} disabled={busy}>
                Restablecer
              </Button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <SwatchRow
                label="Color de piel"
                colors={SKIN_TONES}
                selected={character.skinTone}
                onSelect={(c) => patchCharacter({ skinTone: c })}
                disabled={busy}
              />
              <SwatchRow
                label="Color de cabello"
                colors={HAIR_COLORS}
                selected={character.hairColor}
                onSelect={(c) => patchCharacter({ hairColor: c })}
                disabled={busy}
              />
              <SelectRow
                label="Estilo de cabello"
                value={character.hairStyle}
                options={HAIR_STYLE_OPTIONS}
                onChange={(v) => patchCharacter({ hairStyle: v })}
                disabled={busy}
              />
              <SwatchRow
                label="Color de ojos"
                colors={EYE_COLORS}
                selected={character.eyeColor}
                onSelect={(c) => patchCharacter({ eyeColor: c })}
                disabled={busy}
              />
              <SelectRow
                label="Forma de ojos"
                value={character.eyeStyle}
                options={EYE_STYLE_OPTIONS}
                onChange={(v) => patchCharacter({ eyeStyle: v })}
                disabled={busy}
              />
              <SelectRow
                label="Cejas"
                value={character.eyebrowStyle}
                options={EYEBROW_STYLE_OPTIONS}
                onChange={(v) => patchCharacter({ eyebrowStyle: v })}
                disabled={busy}
              />
              <SelectRow
                label="Vello facial"
                value={character.facialHair}
                options={FACIAL_HAIR_OPTIONS}
                onChange={(v) => patchCharacter({ facialHair: v })}
                disabled={busy}
              />
              <SelectRow
                label="Boca"
                value={character.mouth}
                options={MOUTH_OPTIONS}
                onChange={(v) => patchCharacter({ mouth: v })}
                disabled={busy}
              />
              <SelectRow
                label="Accesorio"
                value={character.accessory}
                options={ACCESSORY_OPTIONS}
                onChange={(v) => patchCharacter({ accessory: v })}
                disabled={busy}
              />
              <SwatchRow
                label="Fondo"
                colors={BACKGROUND_COLORS}
                selected={character.background}
                onSelect={(c) => patchCharacter({ background: c })}
                disabled={busy}
              />
            </div>
          </TabsContent>

          {/* ── Imagen ── */}
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
            </div>
          </TabsContent>
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
