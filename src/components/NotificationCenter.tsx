import * as React from 'react'
import { Bell, CheckCircle2, AlertCircle, Info, XCircle, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { NotificationPayload } from '@/lib/realtime-service'

interface NotificationToastProps {
  notification: NotificationPayload
  onDismiss: (id: string) => void
}

function NotificationToast({ notification, onDismiss }: NotificationToastProps) {
  React.useEffect(() => {
    if (notification.type === 'success') {
      const timer = setTimeout(() => onDismiss(notification.id), 5000)
      return () => clearTimeout(timer)
    }
  }, [notification, onDismiss])

  const bgColor = {
    success: 'bg-emerald-500/10 border-emerald-200 text-emerald-700',
    error: 'bg-red-500/10 border-red-200 text-red-700',
    warning: 'bg-amber-500/10 border-amber-200 text-amber-700',
    info: 'bg-blue-500/10 border-blue-200 text-blue-700',
  }[notification.type]

  const icon = {
    success: <CheckCircle2 className="size-4" />,
    error: <XCircle className="size-4" />,
    warning: <AlertCircle className="size-4" />,
    info: <Info className="size-4" />,
  }[notification.type]

  return (
    <div className={`border rounded-md p-4 flex items-start gap-3 ${bgColor} animate-in slide-in-from-top-2`}>
      <div className="pt-0.5">{icon}</div>
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-sm">{notification.title}</h3>
        <p className="text-xs opacity-90 mt-1">{notification.message}</p>
        {notification.actionUrl && (
          <a href={notification.actionUrl} className="text-xs font-medium underline mt-2 block">
            Ver más →
          </a>
        )}
      </div>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => onDismiss(notification.id)}
        className="text-current opacity-50 hover:opacity-100"
      >
        <X className="size-3" />
      </Button>
    </div>
  )
}

interface NotificationCenterProps {
  notifications: NotificationPayload[]
  onDismiss: (id: string) => void
}

export function NotificationCenter({ notifications, onDismiss }: NotificationCenterProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const unreadCount = notifications.filter((n) => !n.read).length

  return (
    <div className="fixed bottom-4 right-4 space-y-2 max-w-sm z-50">
      {/* Toast notifications */}
      <div className="space-y-2">
        {notifications.slice(0, 3).map((notification) => (
          <NotificationToast key={notification.id} notification={notification} onDismiss={onDismiss} />
        ))}
      </div>

      {/* Notification Bell */}
      {notifications.length > 0 && (
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => setIsOpen(!isOpen)}
            className="relative"
          >
            <Bell className="size-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Button>
        </div>
      )}

      {/* Notification Panel */}
      {isOpen && (
        <div className="bg-background border rounded-lg shadow-lg p-4 max-h-96 overflow-y-auto">
          <h3 className="font-semibold mb-3">Notificaciones</h3>
          {notifications.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay notificaciones</p>
          ) : (
            <div className="space-y-2">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className="border rounded p-2 text-xs flex items-start justify-between gap-2"
                >
                  <div>
                    <p className="font-medium">{notification.title}</p>
                    <p className="text-muted-foreground text-xs mt-1">{notification.message}</p>
                    <p className="text-muted-foreground text-xs mt-1">
                      {new Date(notification.timestamp).toLocaleTimeString('es-ES', {
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: true,
                      })}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => onDismiss(notification.id)}
                    className="flex-shrink-0"
                  >
                    <X className="size-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
