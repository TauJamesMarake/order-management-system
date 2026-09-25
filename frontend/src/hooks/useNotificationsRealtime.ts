import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

/* Live updates for the notifications feed.
 *
 * Subscribes to Postgres Changes on the three tables that feed
 * GET /api/notifications (orders, custom_reminders, notification_dismissals)
 * and invalidates the ['notifications'] query on any change — in this tab
 * and in any other open tab/session for the same business.
 *
 * Security note: supabase.realtime.setAuth(token) attaches the user's own
 * JWT to the Realtime connection. Postgres Changes then respects the same
 * RLS SELECT policies as the REST API, so a user only ever receives change
 * events for rows they could already query — that's the real security
 * boundary here, not the channel name or any client-side filter.
 */
export function useNotificationsRealtime(
    token: string | null,
    businessId: string | undefined,
    enabled: boolean,
) {
    const queryClient = useQueryClient()

    useEffect(() => {
        if (!enabled || !token || !businessId) return

        supabase.realtime.setAuth(token)

        const invalidate = () => {
            queryClient.invalidateQueries({ queryKey: ['notifications'] })
        }

        const channel = supabase
            .channel(`notifications-${businessId}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, invalidate)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'custom_reminders' }, invalidate)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'notification_dismissals' }, invalidate)
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [enabled, token, businessId, queryClient])
}