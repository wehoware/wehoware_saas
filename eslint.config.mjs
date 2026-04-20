import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

/**
 * ESLint flat config using eslint-config-next's native flat-config export
 * (eslint-config-next >= 16 ships flat config directly; FlatCompat is no
 * longer required and can trigger circular-dep errors under ESLint 9).
 *
 * Rule overrides below relax a few React 19 / react-hooks v7 rules that are
 * overly strict for this codebase's universal async-fetch pattern:
 *   - `set-state-in-effect`  : flags every `setLoading(true)` → fetch → `setLoading(false)`
 *   - `preserve-manual-memoization` : flags legitimate useCallback/useMemo usage
 * These are kept as warnings so they still surface but don't block CI.
 * `immutability` and `exhaustive-deps` remain as errors — they catch real bugs.
 */
const eslintConfig = [
  ...nextCoreWebVitals,
  {
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
    },
  },
  {
    ignores: [".next/**", "out/**", "build/**", "node_modules/**"],
  },
];

export default eslintConfig;
