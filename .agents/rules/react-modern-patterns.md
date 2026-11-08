# Modern React 19 Patterns & Guardrails

This project runs on React 19 and Next.js 16. Always adhere to these idioms to prevent re-render cascades, dependency leaks, and stale patterns.

## 1. Separate Reactive Triggers from Non-Reactive Logic with `useEffectEvent`

When an effect needs to perform side effects (invoking data loaders, status dispatches, toast alerts, or callback props like `onReconnect`), do NOT place those functions or their setters into the effect dependency array, and do NOT use `// biome-ignore ... useExhaustiveDependencies`.

Instead, encapsulate them using `useEffectEvent`:

```tsx
// ✅ CORRECT: onSync captures latest props/state without re-triggering the effect
const onSync = useEffectEvent(async (signal: AbortSignal) => {
  setIsLoading(true);
  setSyncing();
  try {
    await performSync(signal);
    setSynced();
  } finally {
    setIsLoading(false);
  }
});

useEffect(() => {
  if (syncVersion < 0) return;
  const controller = new AbortController();
  void onSync(controller.signal);
  return () => controller.abort();
}, [syncVersion]); // Pure reactive trigger
```

- **Rule**: Never include the function returned by `useEffectEvent` in the effect's dependency array (Biome will flag this as an unnecessary dependency).
- **Rule**: Only call Effect Events from inside Effects or subscription listeners attached by an effect.

## 2. No `window` Guards Inside `useEffect`

React guarantees that `useEffect` and `useLayoutEffect` **never execute on the server**.
- **Do NOT** write `if (typeof window === "undefined") return;` inside `useEffect`.
- **Do** guard browser APIs that execute **during render** (e.g. inside `useState(() => typeof window !== "undefined" ? localStorage.getItem(...) : null)` or module-level scope).

## 3. Custom Hook Stability & Destructuring

- Custom hooks that return composite objects must memoize the return object with `useMemo`.
- Action dispatchers returned by custom hooks must be stabilized with `useCallback(..., [])` using functional state updaters (`setState(prev => ...)`).
- Hook consumers should destructure stable actions directly (e.g. `const { setSyncing } = useCloudSyncState()`) rather than referencing composite objects in effect/callback dependencies.

## 4. Pure Derivations over Suppressed Dependencies

When caching computations with a string signature (e.g. `categoriesKey = categories.map(...).join(",")`), do NOT reference the unmemoized source array inside `useMemo` with `// biome-ignore`. Either:
1. Parse/compute directly from the signature key (pure function).
2. Or memoize the upstream collection properly so it can be listed safely in dependencies.
