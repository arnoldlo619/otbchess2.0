import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactPlugin from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import jsxA11y from "eslint-plugin-jsx-a11y";

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
    },
    rules: {
      // ── React ──────────────────────────────────────────────────────────
      ...reactPlugin.configs.recommended.rules,
      "react/react-in-jsx-scope": "off",   // not needed with React 17+ JSX transform
      "react/prop-types": "off",            // TypeScript handles prop types

      // ── React Hooks ────────────────────────────────────────────────────
      ...reactHooks.configs.recommended.rules,

      // ── Accessibility (jsx-a11y) ───────────────────────────────────────
      // Core rule that catches <a> containing <a>, <button>, etc.
      "jsx-a11y/no-redundant-roles": "warn",
      "jsx-a11y/anchor-is-valid": [
        "error",
        {
          components: ["Link"],
          specialLink: ["to", "href"],
          aspects: ["noHref", "invalidHref", "preferButton"],
        },
      ],
      // Prevents interactive elements (button, a) nested inside each other
      "jsx-a11y/interactive-supports-focus": "warn",
      "jsx-a11y/no-noninteractive-element-interactions": "warn",
      // Ensure anchors have accessible content
      "jsx-a11y/anchor-has-content": "error",
      // Ensure images have alt text
      "jsx-a11y/alt-text": "error",
      // Ensure buttons have accessible labels
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

      // ── General ────────────────────────────────────────────────────────
      "no-console": ["warn", { allow: ["warn", "error"] }],
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
