// AuthContext.tsx
import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type UserProfile = {
  id: string;
  email: string;
  role?: string;
  permissions?: { resource: string; action: string }[];
  needs_password_reset?: boolean;
  is_active?: boolean;
};

interface AuthContextType {
  user: UserProfile | null;
  session: any | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch profile details from your backend table
  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, role, permissions, needs_password_reset, is_active")
        .eq("id", userId)
        .single();

      if (error) throw error;
      setUser(data as UserProfile);
    } catch (err) {
      console.error("[AuthProvider] Failed to fetch profile", err);
      // fallback: set minimal user if session exists
      setUser((prev) => prev ?? { id: userId, email: session?.user?.email });
    }
  };

  useEffect(() => {
    console.log("🚀 Auth init starting...");

    const initAuth = async () => {
      const { data } = await supabase.auth.getSession();
      const currentSession = data.session;

      setSession(currentSession);
      setLoading(false); // ✅ stop blocking spinner immediately

      if (currentSession?.user) {
        console.log("🔍 Got session user:", currentSession.user.id);
        // set minimal user immediately
        setUser({
          id: currentSession.user.id,
          email: currentSession.user.email ?? "",
        });
        // then fetch profile in background
        fetchProfile(currentSession.user.id);
      }
    };

    initAuth();

    // Subscribe to auth state changes
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession?.user) {
        setUser({
          id: newSession.user.id,
          email: newSession.user.email ?? "",
        });
        fetchProfile(newSession.user.id);
      } else {
        setUser(null);
      }
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, session, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
