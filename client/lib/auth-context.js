'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from './api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api('/auth/me')
      .then((data) => !cancelled && setUser(data.user))
      .catch(() => !cancelled && setUser(null))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async (mode, username, password) => {
    const data = await api(`/auth/${mode}`, { method: 'POST', body: { username, password } });
    setUser(data.user);
    return data.user;
  }, []);

  const signOut = useCallback(async () => {
    await api('/auth/logout', { method: 'POST' });
    setUser(null);
  }, []);

  const markWelcomed = useCallback(async () => {
    const data = await api('/auth/welcome-seen', { method: 'POST' });
    setUser(data.user);
  }, []);

  const value = useMemo(
    () => ({ user, loading, signIn, signOut, markWelcomed }),
    [user, loading, signIn, signOut, markWelcomed],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
