/**
 * AuthContext — global auth state provider for OTB Chess
 *
 * Wrap the app root with <AuthProvider> and consume with useAuthContext().
 */
import React, { createContext, useContext } from "react";
import { useAuth, AuthUser, UpdateProfileFields } from "../hooks/useAuth";

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string, remember?: boolean) => Promise<AuthUser>;
  register: (
    email: string,
    password: string,
    displayName: string,
    chesscomUsername?: string
  ) => Promise<AuthUser>;
  logout: () => Promise<void>;
  updateProfile: (fields: UpdateProfileFields) => Promise<AuthUser>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
}

export function useAuthContext(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuthContext must be used inside <AuthProvider>");
  return ctx;
}
