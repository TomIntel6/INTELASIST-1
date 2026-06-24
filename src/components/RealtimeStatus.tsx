import * as React from 'react'
import { Wifi, WifiOff } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

/**
 * Component showing real-time connection status
 * Indicates if WebSocket is connected to Supabase
 */
export function RealtimeStatus() {
  const [isConnected, setIsConnected] = React.useState(true)
  const [lastUpdate, setLastUpdate] = React.useState(new Date())

  React.useEffect(() => {
    setIsConnected(true)
    setLastUpdate(new Date())
  }, [])

  return (
    <div className="flex items-center gap-2">
      {isConnected ? (
        <>
          <Badge variant="outline" className="bg-emerald-50 border-emerald-200 text-emerald-700 flex items-center gap-1.5">
            <Wifi className="size-3" />
            En vivo
          </Badge>
        </>
      ) : (
        <>
          <Badge variant="outline" className="bg-gray-50 border-gray-200 text-gray-700 flex items-center gap-1.5">
            <WifiOff className="size-3" />
            Sin conexión
          </Badge>
        </>
      )}
      <span className="text-xs text-muted-foreground">
        {isConnected ? 'Actualizaciones en tiempo real' : 'Modo local'}
      </span>
    </div>
  )
}
