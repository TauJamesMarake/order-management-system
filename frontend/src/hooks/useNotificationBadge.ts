import { useQuery } from '@tanstack/react-query'
import { get } from '@/lib/http'
import { useAuthStore } from '@/stores/auth.store'
import type { iNotificationFeedItem } from '@/types'

export function canViewNotifications(role: string | undefined): boolean {
  return role === 'admin' || role === 'clerk'
}

function countActive(feed: iNotificationFeedItem[]): number {
  return feed.filter((item) => item.kind === 'order' || !item.done).length
}

/**
 * Live badge count for the bell icon, shared by TopBar and SideBar.
 *
 * Reads the same ['notifications'] query the Notifications page uses —
 * TanStack Query dedupes this to the existing cache entry rather than
 * firing an extra request, `select` just applies a per-subscriber
 * transform on top of the shared data.
 */
export function useNotificationBadge(): number {
  const { user } = useAuthStore()
  const canView = !!user && canViewNotifications(user.role)

  const { data } = useQuery<iNotificationFeedItem[], Error, number>({
    queryKey: ['notifications'],
    queryFn: () => get<iNotificationFeedItem[]>('/notifications'),
    enabled: canView,
    select: countActive,
  })

  return data ?? 0
}