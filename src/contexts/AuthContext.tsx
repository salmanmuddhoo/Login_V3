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
      // fallback: keep minimal user
      setUser((prev) => prev ?? null);
    }
  };

  useEffect(() => {
    console.log("🚀 Auth init starting...");

    const initAuth = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        console.error("[AuthProvider] getSession error:", error);
      }

      const currentSession = data?.session ?? null;
      setSession(currentSession);

      if (currentSession?.user) {
        console.log("🔍 Got session user:", currentSession.user.id);

        // Set minimal user immediately
        const minimalUser: UserProfile = {
          id: currentSession.user.id,
          email: currentSession.user.email ?? "",
        };
        setUser(minimalUser);

        // Fetch extended profile in background
        fetchProfile(currentSession.user.id);
      } else {
        setUser(null);
      }

      // ✅ Now we stop blocking spinner
      setLoading(false);
    };

    initAuth();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession?.user) {
        const minimalUser: UserProfile = {
          id: newSession.user.id,
          email: newSession.user.email ?? "",
        };
        setUser(minimalUser);
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
