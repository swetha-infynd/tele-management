import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const STORAGE_KEY = "apex-crm-preferences";

export type ThemeMode = "light" | "dark" | "system";
export type Density = "comfortable" | "compact";
export type FontScale = "small" | "default" | "large";
export type StartPage = "/" | "/leads" | "/attendance" | "/performance" | "/leaderboard";

export interface AppPreferences {
  theme: ThemeMode;
  density: Density;
  fontScale: FontScale;
  reduceMotion: boolean;
  sidebarCollapsed: boolean;
  stickyTableHeaders: boolean;
  tablePageSize: number;
  startPage: StartPage;
  dateFormat: "dd MMM yyyy" | "yyyy-MM-dd" | "MM/dd/yyyy";
  timeFormat: "12h" | "24h";
  autoRefreshSeconds: number;
  showTips: boolean;
}

export const DEFAULT_PREFERENCES: AppPreferences = {
  theme: "system",
  density: "comfortable",
  fontScale: "default",
  reduceMotion: false,
  sidebarCollapsed: false,
  stickyTableHeaders: true,
  tablePageSize: 25,
  startPage: "/",
  dateFormat: "dd MMM yyyy",
  timeFormat: "12h",
  autoRefreshSeconds: 0,
  showTips: true,
};

interface PreferencesContextValue {
  prefs: AppPreferences;
  resolvedTheme: "light" | "dark";
  setPref: <K extends keyof AppPreferences>(key: K, value: AppPreferences[K]) => void;
  reset: () => void;
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<AppPreferences>(DEFAULT_PREFERENCES);
  const [systemDark, setSystemDark] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setPrefs({ ...DEFAULT_PREFERENCES, ...(JSON.parse(raw) as Partial<AppPreferences>) });
    } catch {
      /* ignore corrupt storage */
    }
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    setSystemDark(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const resolvedTheme: "light" | "dark" =
    prefs.theme === "system" ? (systemDark ? "dark" : "light") : prefs.theme;

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", resolvedTheme === "dark");
    root.dataset["density"] = prefs.density;
    root.dataset["fontScale"] = prefs.fontScale;
    root.dataset["reduceMotion"] = prefs.reduceMotion ? "true" : "false";
    root.style.colorScheme = resolvedTheme;
  }, [resolvedTheme, prefs.density, prefs.fontScale, prefs.reduceMotion]);

  const persist = useCallback((next: AppPreferences) => {
    setPrefs(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* storage unavailable */
    }
  }, []);

  const value = useMemo<PreferencesContextValue>(
    () => ({
      prefs,
      resolvedTheme,
      setPref: (key, val) => persist({ ...prefs, [key]: val }),
      reset: () => persist(DEFAULT_PREFERENCES),
    }),
    [prefs, resolvedTheme, persist],
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error("usePreferences must be used inside PreferencesProvider");
  return ctx;
}
