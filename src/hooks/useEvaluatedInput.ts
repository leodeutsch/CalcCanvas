import { useEffect, useRef, useState } from "react";
import { scheduleIdle } from "../utils/scheduleIdle";

export function useEvaluatedInput<T>(
  value: string,
  evaluate: (expr: string) => T
) {
  const [result, setResult] = useState<T | null>(null);
  const version = useRef(0);

  useEffect(() => {
    const myVersion = ++version.current;
    const cancel = scheduleIdle(() => {
      if (myVersion === version.current) {
        setResult(evaluate(value));
      }
    });
    return () => {};
  }, [value, evaluate]);

  return result;
}
