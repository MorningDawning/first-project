import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { getToken, setToken as persistToken } from "../api/client";
import { authApi, userApi } from "../api/beervia";
import { UserProfile } from "../types";

type AuthContextValue = {
  isLoading: boolean;
  isAuthenticated: boolean;
  user: UserProfile | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<UserProfile | null>(null);

  const refreshUser = useCallback(async () => {
    const profile = await userApi.me();
    setUser(profile);
  }, []);

  useEffect(() => {
    (async () => {
      const token = await getToken();
      if (token) {
        try {
          await refreshUser();
        } catch {
          await persistToken(null);
        }
      }
      setIsLoading(false);
    })();
  }, [refreshUser]);

  const login = useCallback(async (email: string, password: string) => {
    const { token } = await authApi.login(email, password);
    await persistToken(token);
    await refreshUser();
  }, [refreshUser]);

  const register = useCallback(async (email: string, password: string, name: string) => {
    const { token } = await authApi.register(email, password, name);
    await persistToken(token);
    await refreshUser();
  }, [refreshUser]);

  const logout = useCallback(async () => {
    await persistToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ isLoading, isAuthenticated: !!user, user, login, register, logout, refreshUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth должен использоваться внутри AuthProvider");
  return ctx;
}
