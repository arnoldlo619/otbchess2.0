/**
 * AuthContext — global auth state provider for OTB Chess
 *
 * Wrap the app root with <AuthProvider> and consume with useAuthContext().
 *
 * HMR resilience: the context is created with a safe no-op default value so
 * that a Vite hot-reload cycle that temporarily invalidates the module graph
 * degrades gracefully (user is treated as logged-out) rather than throwing
 * "useAuthContext must be used inside <AuthProvider>".
 */
import React, { createContext, useContext } from "react";
import { useAuth, AuthUser, UpdateProfileFields } from "../hooks/useAuth";

export interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string, remember?: boolean) => Promise<AuthUser>;
  register: (
    email: string,
    password: string,
    displayName: string,
    chesscomUsername?: string
  ) => Promise<AuthUser>;
  /** Creates an ephemeral 24-hour guest session with just a display name. */
  loginAsGuest: (displayName: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  updateProfile: (fields: UpdateProfileFields) => Promise<AuthUser>;
}

// Safe no-op default — used when a component is rendered outside <AuthProvider>
// (e.g., during a Vite HMR cycle). All async methods return a rejected promise
// so callers that await them will surface a clear error rather than hanging.
const noop = () => Promise.reject(new Error("AuthProvider not mounted"));

const DEFAULT_VALUE: AuthContextValue = {
  user: null,
  loading: true,
  login: noop as unknown as AuthContextValue["login"],
  register: noop as unknown as AuthContextValue["register"],
  loginAsGuest: noop as unknown as AuthContextValue["loginAsGuest"],
  logout: noop as unknown as AuthContextValue["logout"],
  updateProfile: noop as unknown as AuthContextValue["updateProfile"],
};

const AuthContext = createContext<AuthContextValue>(DEFAULT_VALUE);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
}

export function useAuthContext(): AuthContextValue {
  return useContext(AuthContext);
}
