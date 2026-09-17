import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { User } from "../types";

type AuthValue = {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (
    name: string,
    email: string,
    password: string,
    confirmPassword: string,
  ) => Promise<void>;
  logout: () => void;
};

type AuthResponse = {
  pengguna: User;
  token: string;
};

const AuthContext = createContext<AuthValue | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const queryClient = useQueryClient();
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("barber_token"));
  const [user, setUser] = useState<User | null>(() => {
    try {
      return JSON.parse(localStorage.getItem("barber_user") ?? "null") as User | null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(Boolean(token));

  const logout = useCallback(() => {
    localStorage.removeItem("barber_token");
    localStorage.removeItem("barber_user");
    queryClient.clear();
    setToken(null);
    setUser(null);
    setLoading(false);
  }, [queryClient]);

  useEffect(() => {
    window.addEventListener("auth:logout", logout);
    return () => window.removeEventListener("auth:logout", logout);
  }, [logout]);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    api
      .get<{ pengguna: User }>("/auth/me")
      .then(({ data }) => {
        setUser(data.pengguna);
        localStorage.setItem("barber_user", JSON.stringify(data.pengguna));
      })
      .catch(() => logout())
      .finally(() => setLoading(false));
  }, [logout, token]);

  const login = useCallback(
    async (email: string, password: string) => {
      const { data } = await api.post<AuthResponse>("/auth/login", { email, password });
      queryClient.clear();
      localStorage.setItem("barber_token", data.token);
      localStorage.setItem("barber_user", JSON.stringify(data.pengguna));
      setToken(data.token);
      setUser(data.pengguna);
    },
    [queryClient],
  );

  const register = useCallback(
    async (name: string, email: string, password: string, confirmPassword: string) => {
      await api.post("/auth/register", { name, email, password, confirmPassword });
      await login(email, password);
    },
    [login],
  );

  const value = useMemo(
    () => ({ user, token, loading, login, register, logout }),
    [user, token, loading, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth harus di dalam AuthProvider");
  return context;
};
