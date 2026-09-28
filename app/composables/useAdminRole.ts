// Role of the signed-in user, fetched once per user id (a different login refetches).
export function useAdminRole() {
  const cached = useState<{ userId: string, role: string | null } | null>('admin-role', () => null)
  const user = useSupabaseUser()
  const requestFetch = useRequestFetch()

  async function load() {
    const userId = user.value?.sub
    if (!userId) return null
    if (cached.value?.userId !== userId) {
      const role = await requestFetch('/api/me').then((res: any) => res.profile.role as string).catch(() => null)
      cached.value = { userId, role }
    }
    return cached.value.role
  }

  return { load }
}
