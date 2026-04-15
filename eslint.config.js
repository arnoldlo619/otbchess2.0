import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactPlugin from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import jsxA11y from "eslint-plugin-jsx-a11y";
import validateJsxNesting from "eslint-plugin-validate-jsx-nesting";

export default tseslint.config(
  // ── Base JS recommended ──────────────────────────────────────────────────
  js.configs.recommended,

  // ── TypeScript recommended (type-aware rules disabled for speed) ─────────
  ...tseslint.configs.recommended,

  // ── Global settings ──────────────────────────────────────────────────────
  {
    settings: {
      react: { version: "detect" },
    },
  },

  // ── Source files ─────────────────────────────────────────────────────────
  {
    files: ["client/src/**/*.{ts,tsx}", "server/**/*.ts", "shared/**/*.ts"],
    plugins: {
      react: reactPlugin,
      "react-hooks": reactHooks,
      "jsx-a11y": jsxA11y,
      "validate-jsx-nesting": validateJsxNesting,
    },
    rules: {
      // ── React ──────────────────────────────────────────────────────────
      ...reactPlugin.configs.recommended.rules,
      "react/react-in-jsx-scope": "off",        // not needed with React 17+ JSX transform
      "react/prop-types": "off",                 // TypeScript handles prop types
      "react/no-unescaped-entities": "off",      // too noisy for existing codebase

      // ── React Hooks ────────────────────────────────────────────────────
      // Keep core hooks rules; disable React Compiler rules that flag
      // legitimate async-in-effect patterns the compiler handles natively.
      "react-hooks/exhaustive-deps": "warn",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/set-state-in-effect": "off",  // React Compiler handles this; rule incompatible with async fetch patterns
      "react-hooks/purity": "off",
      "react-hooks/static-components": "off",
      "react-hooks/immutability": "off",
      "react-hooks/preserve-manual-memoization": "off",

      // ── Accessibility (jsx-a11y) ───────────────────────────────────────
      "jsx-a11y/no-redundant-roles": "warn",
      "jsx-a11y/anchor-is-valid": [
        "error",
        {
          components: ["Link"],
          specialLink: ["to", "href"],
          aspects: ["noHref", "invalidHref", "preferButton"],
        },
      ],
      "jsx-a11y/interactive-supports-focus": "warn",
      "jsx-a11y/no-noninteractive-element-interactions": "warn",
      "jsx-a11y/anchor-has-content": "error",
      "jsx-a11y/alt-text": "error",
      "jsx-a11y/aria-props": "error",
      "jsx-a11y/aria-proptypes": "error",
      "jsx-a11y/aria-unsupported-elements": "error",
      "jsx-a11y/role-has-required-aria-props": "error",

      // ── TypeScript ─────────────────────────────────────────────────────
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-empty-object-type": "off",

      // ── JSX nesting validation (<a> inside <a>, <button> inside <a>) ──
      "validate-jsx-nesting/no-invalid-jsx-nesting": "error",

      // ── General ────────────────────────────────────────────────────────
      "no-console": ["warn", { allow: ["warn", "error"] }],
      // Disable noisy base rules that conflict with existing patterns
      "no-useless-assignment": "off",
      "no-constant-condition": "off",
      "no-constant-binary-expression": "off",
      "no-empty": "off",
      "prefer-const": "off",
    },
  },

  // ── Test files — relax some rules ────────────────────────────────────────
  {
    files: ["**/*.test.{ts,tsx}", "**/__tests__/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "no-console": "off",
    },
  },

  // ── Ignore patterns ───────────────────────────────────────────────────────
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "*.config.js",
      "*.config.ts",
      "drizzle/**",
      "public/**",
    ],
  }
);
