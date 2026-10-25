import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { clearStoredAuthSession, supabase } from '@/lib/supabase';
import { normalizeExperienceLevel } from '@/lib/experience-level';
import type { Profile } from '@/types';

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: string | null; confirmationRequired: boolean }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadProfile(
    userId: string,
    fallbackName = '',
    isCurrent: () => boolean = () => true,
  ) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    if (!isCurrent()) return;
    if (error) {
      setProfile(null);
      return;
    }
    if (data) {
      setProfile({ ...data, experience_level: normalizeExperienceLevel(data.experience_level) } as Profile);
      return;
    }

    // Accounts created while email confirmation is enabled cannot insert their
    // profile until their first authenticated session. Create it on that session.
    const { data: created, error: createError } = await supabase.from('profiles').upsert({
      id: userId,
      full_name: fallbackName,
      career_field: '',
      experience_level: 'junior',
    }).select('*').maybeSingle();
    if (!isCurrent()) return;
    setProfile(!createError && created
      ? { ...created, experience_level: normalizeExperienceLevel(created.experience_level) } as Profile
      : null);
  }

  useEffect(() => {
    let active = true;
    let authEventObserved = false;
    let currentUserId: string | null = null;
    let profileLoadTimer: number | null = null;
    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => {
      authEventObserved = true;
      currentUserId = s?.user.id ?? null;
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        setLoading(false);
        const userId = s.user.id;
        if (profileLoadTimer !== null) window.clearTimeout(profileLoadTimer);
        // Defer the profile query until Supabase releases its auth-state lock.
        profileLoadTimer = window.setTimeout(() => {
          profileLoadTimer = null;
          void loadProfile(userId, String(s.user.user_metadata?.full_name ?? ''), () => active && currentUserId === userId);
        }, 0);
      } else {
        if (profileLoadTimer !== null) window.clearTimeout(profileLoadTimer);
        profileLoadTimer = null;
        setProfile(null);
        setLoading(false);
      }
    });

    supabase.auth.getSession()
      .then(({ data: { session: s } }) => {
        if (!active || authEventObserved) return;
        currentUserId = s?.user.id ?? null;
        setSession(s);
        setUser(s?.user ?? null);
        setLoading(false);
        if (s?.user) {
          const userId = s.user.id;
          void loadProfile(userId, String(s.user.user_metadata?.full_name ?? ''), () => active && currentUserId === userId);
        }
      })
      .catch(() => {
        if (!active || authEventObserved) return;
        setSession(null);
        setUser(null);
        setProfile(null);
        currentUserId = null;
        setLoading(false);
      });

    return () => {
      active = false;
      if (profileLoadTimer !== null) window.clearTimeout(profileLoadTimer);
      listener.subscription.unsubscribe();
    };
  }, []);

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }

  async function signUp(email: string, password: string, fullName: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    if (error) return { error: error.message, confirmationRequired: false };
    return { error: null, confirmationRequired: !data.session };
  }

  async function signOut() {
    // Clear the local session first so logout also works when Supabase is offline.
    clearStoredAuthSession();
    setSession(null);
    setUser(null);
    setProfile(null);
    setLoading(false);

    try {
      const { error } = await supabase.auth.signOut({ scope: 'local' });
      if (error) console.warn('La sesión local se cerró, pero Supabase no confirmó la salida remota.', error);
    } catch (error) {
      console.warn('La sesión local se cerró; no se pudo confirmar la salida remota.', error);
    } finally {
      clearStoredAuthSession();
      setSession(null);
      setUser(null);
      setProfile(null);
    }
  }

  async function refreshProfile() {
    if (user) await loadProfile(user.id, String(user.user_metadata?.full_name ?? ''));
  }

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, signIn, signUp, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
