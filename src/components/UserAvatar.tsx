import * as React from 'react'
import { CharacterAvatar } from '@/components/CharacterAvatar'
import { normalizeAvatar } from '@/lib/avatar'
import type { AvatarData } from '@/lib/avatar'
import { cn } from '@/lib/utils'

interface UserAvatarProps {
  avatar?: AvatarData | unknown | null
  name?: string | null
  /** URL heredada (user_metadata.avatar_url) usada si no hay avatar estructurado. */
  fallbackImageUrl?: string | null
  /** Tamaño del lado en píxeles. */
  size?: number
  className?: string
}

function getInitials(name: string): string {
  return (
    name
      .split(' ')
      .map((part) => part.trim()[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase() || 'U'
  )
}

/**
 * Avatar de usuario unificado: muestra el personaje vectorial, una imagen subida
 * o las iniciales como fallback. Siempre recortado en círculo.
 */
export const UserAvatar = React.memo(function UserAvatar({
  avatar,
  name,
  fallbackImageUrl,
  size = 36,
  className,
}: UserAvatarProps) {
  const data: AvatarData | null = React.useMemo(() => normalizeAvatar(avatar), [avatar])
  const displayName = name?.trim() || 'Usuario'

  const baseClass = cn(
    'relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full',
    className
  )

  if (data?.mode === 'character' && data.character) {
    return (
      <span className={baseClass} style={{ width: size, height: size }}>
        <CharacterAvatar config={data.character} size={size} title={`Avatar de ${displayName}`} />
      </span>
    )
  }

  const imageUrl = data?.mode === 'image' && data.imageUrl ? data.imageUrl : fallbackImageUrl || null

  if (imageUrl) {
    return (
      <span className={baseClass} style={{ width: size, height: size }}>
        <img src={imageUrl} alt={displayName} className="size-full object-cover" />
      </span>
    )
  }

  return (
    <span
      className={cn(baseClass, 'bg-primary/10 font-semibold text-primary')}
      style={{ width: size, height: size, fontSize: Math.max(10, Math.round(size * 0.38)) }}
    >
      {getInitials(displayName)}
    </span>
  )
})

export default UserAvatar
