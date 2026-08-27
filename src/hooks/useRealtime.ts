import * as React from 'react'
import { RealtimeService, type RealtimeEvent, type NotificationPayload } from '@/lib/realtime-service'

/**
 * Hook for subscribing to real-time updates from Supabase
 * Automatically handles cleanup on unmount
 */
export function useRealtimeAuditLogs(callback: (event: RealtimeEvent<any>) => void) {
  React.useEffect(() => {
    const channelName = RealtimeService.subscribeToAuditLogs(callback)

    return () => {
      RealtimeService.unsubscribe(channelName, callback)
    }
  }, [callback])
}

/**
 * Hook for subscribing to real-time permission changes
 */
export function useRealtimePermissions(userId: string, callback: (event: RealtimeEvent<any>) => void) {
  React.useEffect(() => {
    const channelName = RealtimeService.subscribeToUserPermissions(userId, callback)

    return () => {
      RealtimeService.unsubscribe(channelName, callback)
    }
  }, [userId, callback])
}

/**
 * Hook for subscribing to real-time deleted reports (trash changes)
 */
export function useRealtimeDeletedReports(callback: (event: RealtimeEvent<any>) => void) {
  React.useEffect(() => {
    const channelName = RealtimeService.subscribeToDeletedReports(callback)

    return () => {
      RealtimeService.unsubscribe(channelName, callback)
    }
  }, [callback])
}

/**
 * Hook for subscribing to real-time user activity
 */
export function useRealtimeUserActivity(callback: (event: RealtimeEvent<any>) => void) {
  React.useEffect(() => {
    const channelName = RealtimeService.subscribeToUserActivity(callback)

    return () => {
      RealtimeService.unsubscribe(channelName, callback)
    }
  }, [callback])
}

/**
 * Hook for subscribing to real-time report changes (e.g. a newly created report
 * appearing live in the list). Cleans up the subscription on unmount.
 */
export function useRealtimeReports(callback: (event: RealtimeEvent<any>) => void) {
  const callbackRef = React.useRef(callback)
  callbackRef.current = callback

  React.useEffect(() => {
    const listener = (event: RealtimeEvent<any>) => callbackRef.current(event)
    const channelName = RealtimeService.subscribeToReports(listener)

    return () => {
      RealtimeService.unsubscribe(channelName, listener)
    }
  }, [])
}

/**
 * Hook for subscribing to notifications
 */
export function useNotifications(userId: string) {
  const [notifications, setNotifications] = React.useState<NotificationPayload[]>([])

  React.useEffect(() => {
    const channelName = RealtimeService.subscribeToNotifications(userId, (notification) => {
      setNotifications((prev) => [notification, ...prev])

      // Auto-remove after 5 seconds if success
      if (notification.type === 'success') {
        setTimeout(() => {
          setNotifications((prev) => prev.filter((n) => n.id !== notification.id))
        }, 5000)
      }
    })

    return () => {
      RealtimeService.unsubscribeFromNotifications(channelName, () => {})
    }
  }, [userId])

  const removeNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id))
  }

  return { notifications, removeNotification }
}

/**
 * Hook for manually triggering notifications
 */
export function useNotificationTrigger(userId: string) {
  return React.useCallback(
    (title: string, message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info', actionUrl?: string) => {
      const notification: NotificationPayload = {
        id: `notif-${Date.now()}`,
        title,
        message,
        type,
        timestamp: new Date(),
        read: false,
        actionUrl,
      }
      RealtimeService.sendNotification(userId, notification)
    },
    [userId]
  )
}
