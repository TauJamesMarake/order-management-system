import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data is considered fresh for 1 minute
      staleTime: 60_000,
      // Keep cached data for 5 minutes after component unmounts
      gcTime: 5 * 60_000,
      // Retry failed requests once before showing an error
      retry: 1,
      // Don't refetch just because the user switched browser tabs
      refetchOnWindowFocus: false,
    },
    mutations: {
      // Surface mutation errors — let each component handle them
      throwOnError: false,
    },
  },
})