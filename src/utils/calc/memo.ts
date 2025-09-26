export const makeLRU = <K, V>(capacity = 256) => {
  const map = new Map<K, V>();
  return {
    get(key: K): V | undefined {
      const v = map.get(key);
      if (v !== undefined) {
        map.delete(key);
        map.set(key, v);
      }
      return v;
    },
    set(key: K, val: V) {
      if (map.has(key)) map.delete(key);
      map.set(key, val);
      if (map.size > capacity) {
        const first = map.keys().next().value;
        if (first !== undefined) {
          map.delete(first);
        }
      }
    },
  };
};
