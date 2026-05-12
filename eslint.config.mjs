import js from "@eslint/js";
import nextPlugin from "@next/eslint-plugin-next";
import jsxA11yPlugin from "eslint-plugin-jsx-a11y";
import reactPlugin from "eslint-plugin-react";
import reactHooksPlugin from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

export default tseslint.config(
	{
		ignores: [
			".next/**",
			"node_modules/**",
			"out/**",
			"build/**",
			"coverage/**",
			"next-env.d.ts",
			"prisma/generated/**",
			"prisma/migrations/**",
			"scripts/daemon/**",
		],
	},
	js.configs.recommended,
	...tseslint.configs.recommended,
	{
		files: ["**/*.{jsx,tsx}"],
		plugins: {
			react: reactPlugin,
			"react-hooks": reactHooksPlugin,
			"jsx-a11y": jsxA11yPlugin,
			"@next/next": nextPlugin,
		},
		rules: {
			...reactPlugin.configs.recommended.rules,
			...reactPlugin.configs["jsx-runtime"].rules,
			...reactHooksPlugin.configs.recommended.rules,
			...jsxA11yPlugin.configs.recommended.rules,
			...nextPlugin.configs.recommended.rules,
			...nextPlugin.configs["core-web-vitals"].rules,
			"react/react-in-jsx-scope": "off",
			"react/prop-types": "off",
			"jsx-a11y/no-autofocus": "off",
			"jsx-a11y/media-has-caption": "off",
			"jsx-a11y/click-events-have-key-events": "off",
			"jsx-a11y/no-static-element-interactions": "off",
			"jsx-a11y/no-noninteractive-element-interactions": "off",
			"jsx-a11y/role-has-required-aria-props": "off",
			"jsx-a11y/iframe-has-title": "off",
			"@next/next/no-img-element": "off",
			"react/no-unknown-property": "off",
			"no-control-regex": "off",
		},
		settings: {
			react: { version: "detect" },
		},
	},
	{
		rules: {
			"@typescript-eslint/no-unused-vars": [
				"warn",
				{
					caughtErrors: "none",
					argsIgnorePattern: "^_",
					varsIgnorePattern: "^_",
				},
			],
			"@typescript-eslint/no-explicit-any": "warn",
		},
	},
);
