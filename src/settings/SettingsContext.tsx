import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

type Settings = {
  locale: "auto" | string; // ex: "pt-BR", "en-US"
  baseCurrency: string; // ex: "BRL", "USD"
  defaultPrecision: 2; // 0..6
  allowRand: boolean;
};

const DEFAULTS: Settings = {
  locale: "auto",
  baseCurrency: "BRL",
  defaultPrecision: 2,
  allowRand: true,
};

const KEY = "@calccanvas/settings/v1";

const Ctx = createContext<{
  settings: Settings;
  setSettings: (s: Partial<Settings>) => void;
  ready: boolean;
}>({ settings: DEFAULTS, setSettings: () => {}, ready: false });

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [settings, setSettingsState] = useState<Settings>(DEFAULTS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(KEY);
        if (raw) setSettingsState({ ...DEFAULTS, ...JSON.parse(raw) });
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const setSettings = (patch: Partial<Settings>) => {
    setSettingsState((prev) => {
      const next = { ...prev, ...patch };
      AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  };

  const value = useMemo(
    () => ({ settings, setSettings, ready }),
    [settings, ready]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

export const useSettings = () => useContext(Ctx);
