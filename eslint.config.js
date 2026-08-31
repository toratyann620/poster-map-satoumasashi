import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // ios / android は Capacitor が生成するネイティブプロジェクト。
  // Gradle のビルド生成物（native-bridge.js 等）が lint 対象に入るため除外する。
  // build はリリース時の成果物置き場（.xcarchive の中に JS が入る）
  globalIgnores(['dist', 'build', 'ios', 'android']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
])
