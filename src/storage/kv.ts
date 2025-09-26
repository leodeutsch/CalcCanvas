let mem = new Map<string, string>();

let AsyncStorage: {
  getItem(k: string): Promise<string | null>;
  setItem(k: string, v: string): Promise<void>;
} | null = null;
try {
  // opcional: só existe em runtime RN/Expo
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  AsyncStorage = require("@react-native-async-storage/async-storage").default;
} catch {}

export const kvGet = async (key: string): Promise<string | null> => {
  if (AsyncStorage) return await AsyncStorage.getItem(key);
  return mem.get(key) ?? null;
};

export const kvSet = async (key: string, value: string): Promise<void> => {
  if (AsyncStorage) return AsyncStorage.setItem(key, value);
  mem.set(key, value);
};
