import { supabase } from '@/lib/supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'
import type { AuditLog } from '@/lib/permissions'

export interface RealtimeEvent<T = any> {
  type: 'INSERT' | 'UPDATE' | 'DELETE'
  record: T
  oldRecord?: T
  timestamp: Date
}

export interface NotificationPayload {
  id: string
  title: string
  message: string
  type: 'success' | 'error' | 'info' | 'warning'
  timestamp: Date
  read: boolean
  actionUrl?: string
}

/**
 * Service for real-time updates via Supabase WebSocket
 * Allows components to subscribe to table changes and receive live updates
 */
export class RealtimeService {
  private static channels: Map<string, RealtimeChannel> = new Map()
  private static listeners: Map<string, Set<Function>> = new Map()
  private static notifications: Map<string, Set<(notification: NotificationPayload) => void>> = new Map()

  /**
   * Subscribe to audit log changes (new entries, updates)
   */
  static subscribeToAuditLogs(callback: (event: RealtimeEvent<AuditLog>) => void) {
    return this.subscribeToTable('audit_logs', callback)
  }

  /**
   * Subscribe to permission changes for a user
   */
  static subscribeToUserPermissions(userId: string, callback: (event: RealtimeEvent<any>) => void) {
    const channelName = `user_permissions:${userId}`
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_permission_details',
          filter: `permission_id=in.(SELECT id FROM user_permissions WHERE user_id=eq.${userId})`,
        },
        (payload: any) => {
          const event: RealtimeEvent = {
            type: payload.eventType,
            record: payload.new,
            oldRecord: payload.old,
            timestamp: new Date(),
          }
          callback(event)
        }
      )
      .subscribe()

    this.channels.set(channelName, channel)
    return channelName
  }

  /**
   * Subscribe to deleted reports (trash changes)
   */
  static subscribeToDeletedReports(callback: (event: RealtimeEvent<any>) => void) {
    return this.subscribeToTable('deleted_reports', callback)
  }

  /**
   * Subscribe to user activity log (suspensions, metrics)
   */
  static subscribeToUserActivity(callback: (event: RealtimeEvent<any>) => void) {
    return this.subscribeToTable('user_activity_log', callback)
  }

  /**
   * Subscribe to report changes (new reports appear live, status updates, deletions).
   * Uses the cheap Realtime channel instead of polling the pooler.
   */
  static subscribeToReports(callback: (event: RealtimeEvent<any>) => void) {
    return this.subscribeToTable('reports', callback)
  }

  /**
   * Generic table subscription
   */
  private static subscribeToTable(tableName: string, callback: (event: RealtimeEvent<any>) => void) {
    const channelName = `${tableName}:all`
    const startedAt = performance.now()

    // Reuse existing channel if already subscribed
    if (this.channels.has(channelName)) {
      const listeners = this.listeners.get(channelName) || new Set()
      listeners.add(callback)
      this.listeners.set(channelName, listeners)
      return channelName
    }

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: tableName,
        },
        (payload: any) => {
          const event: RealtimeEvent = {
            type: payload.eventType,
            record: payload.new || payload.old,
            oldRecord: payload.old,
            timestamp: new Date(),
          }

          // Call all registered listeners
          const listeners = this.listeners.get(channelName) || new Set()
          listeners.forEach((listener) => listener(event))
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`✓ Subscribed to ${tableName}`, { durationMs: Math.round(performance.now() - startedAt) })
        } else if (status === 'CLOSED') {
          console.log(`✗ Unsubscribed from ${tableName}`)
        }
      })

    this.channels.set(channelName, channel)

    // Register listener
    const listeners = this.listeners.get(channelName) || new Set()
    listeners.add(callback)
    this.listeners.set(channelName, listeners)

    return channelName
  }

  /**
   * Unsubscribe from a channel
   */
  static unsubscribe(channelName: string, callback?: (event: RealtimeEvent<any>) => void) {
    // Si se pasa el callback, quitar solo ese listener; cerrar el canal compartido
    // unicamente cuando ya no queden listeners (evita cortar eventos a otros consumidores).
    const listeners = this.listeners.get(channelName)
    if (listeners && callback) {
      listeners.delete(callback as Function)
    }

    const stillHasListeners = !!listeners && listeners.size > 0
    if (!stillHasListeners) {
      const channel = this.channels.get(channelName)
      if (channel) {
        supabase.removeChannel(channel)
      }
      this.channels.delete(channelName)
      this.listeners.delete(channelName)
      console.log(`✓ Unsubscribed from ${channelName}`)
    }
  }

  /**
   * Unsubscribe all channels
   */
  static unsubscribeAll() {
    this.channels.forEach((channel, name) => {
      supabase.removeChannel(channel)
      console.log(`✓ Unsubscribed from ${name}`)
    })
    this.channels.clear()
    this.listeners.clear()
  }

  /**
   * Send a notification to subscribers
   */
  static sendNotification(userId: string, notification: NotificationPayload) {
    const notificationChannelName = `notifications:${userId}`
    const listeners = this.notifications.get(notificationChannelName) || new Set()
    listeners.forEach((listener) => listener(notification))
  }

  /**
   * Subscribe to notifications for a user
   */
  static subscribeToNotifications(userId: string, callback: (notification: NotificationPayload) => void) {
    const channelName = `notifications:${userId}`
    const listeners = this.notifications.get(channelName) || new Set()
    listeners.add(callback)
    this.notifications.set(channelName, listeners)
    return channelName
  }

  /**
   * Unsubscribe from notifications
   */
  static unsubscribeFromNotifications(channelName: string, callback: (notification: NotificationPayload) => void) {
    const listeners = this.notifications.get(channelName) || new Set()
    listeners.delete(callback)
    this.notifications.set(channelName, listeners)
  }
}
