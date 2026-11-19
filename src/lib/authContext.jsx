import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react'
import { mockLogin, readSession, writeSession, can, canEditProject, canDeleteProject } from './auth'

const Ctx = createContext(null)
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null), [ready, setReady] = useState(false)
  useEffect(() => { setUser(readSession()); setReady(true) }, [])
  // sinkron antar tab: keluar di satu tab = keluar di semua
  useEffect(() => { const h = (e) => e.key === 'pln-session-v1' && setUser(readSession()); window.addEventListener('storage', h); return () => window.removeEventListener('storage', h) }, [])
  const login = useCallback(async (email, password) => { const r = await mockLogin(email, password); if (r.ok) { writeSession(r.user); setUser(r.user) } return r }, [])
  const logout = useCallback(() => { writeSession(null); setUser(null) }, [])
  const value = useMemo(() => ({ user, ready, login, logout, can: (perm) => can(user, perm), canEdit: (p) => canEditProject(user, p), canDelete: (p) => canDeleteProject(user, p) }), [user, ready, login, logout])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
export const useAuth = () => useContext(Ctx)
