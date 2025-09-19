import { useEffect, useRef, useState } from "react";

export function useDebouncedValue<T>(value: T, delay = 50) {
  const [debounced, setDebounced] = useState(value);
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (t.current) clearTimeout(t.current);
    t.current = setTimeout(() => setDebounced(value), delay);
    return () => {
      if (t.current) clearTimeout(t.current);
    };
  }, [value, delay]);

  return debounced;
}
