// AuthContext.tsx (debug version)
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
    console.log("📡 Fetching profile for:", userId);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, role, permissions, needs_password_reset, is_active")
        .eq("id", userId)
        .single();

      if (error) {
        console.error("❌ Profile fetch error:", error);
        return;
      }

      console.log("✅ Profile fetched:", data);
      setUser(data as UserProfile);
    } catch (err) {
      console.error("🔥 Unexpected profile fetch error:", err);
    }
  };

  useEffect(() => {
    console.log("🚀 Auth init starting...");

    const initAuth = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        console.error("❌ getSession error:", error);
      }

      const currentSession = data?.session ?? null;
      console.log("📦 Initial session:", currentSession);
      setSession(currentSession);

      if (currentSession?.user) {
        console.log("🔑 Found session user:", currentSession.user.id);
        setUser({ id: currentSession.user.id, email: currentSession.user.email ?? "" });
        fetchProfile(currentSession.user.id);
      } else {
        setUser(null);
      }

      setLoading(false);
    };

    initAuth();

    const { data: listener } = supabase.auth.onAuthStateChange((event, newSession) => {
      console.log("🌀 Auth state change:", event, newSession);
      setSession(newSession);

      if (newSession?.user) {
        console.log("✅ Setting minimal user from auth change:", newSession.user.id);
        setUser({ id: newSession.user.id, email: newSession.user.email ?? "" });
        fetchProfile(newSession.user.id);
      } else {
        console.log("🚪 Signed out, clearing user");
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
