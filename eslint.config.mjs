import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // The bake pipeline ships typed signatures ahead of their bodies, so
      // unimplemented parameters are deliberate. Underscore marks them as
      // intentional and keeps genuinely dead variables visible.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
  // Last: formatting belongs to Prettier, so drop any rule that would fight it.
  prettier,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Baked artifacts are generated output, not source.
    "public/resorts/**",
  ]),
]);

export default eslintConfig;
