import { useEffect, useState } from "react";
import { api } from "../../api";
import type { ObservabilitySnapshot } from "../../../shared/observability";
export function useObservabilitySnapshot(owner: boolean) {
  const [snapshot, setSnapshot] = useState<ObservabilitySnapshot | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!owner) {
      setSnapshot(null);
      return;
    }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const refresh = async () => {
      if (cancelled) return;
      if (document.visibilityState !== "hidden") {
        try {
          const result = await api.observability();
          if (!cancelled) {
            setSnapshot(result);
            setError("");
          }
        } catch (cause) {
          if (!cancelled)
            setError(
              cause instanceof Error
                ? cause.message
                : "Could not load observability",
            );
        }
      }
      if (!cancelled) timer = setTimeout(refresh, 15000);
    };
    void refresh();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [owner, retry]);
  return {
    snapshot: owner ? snapshot : null,
    error,
    retry: () => setRetry((value) => value + 1),
  };
}
