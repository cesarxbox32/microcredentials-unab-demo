import tseslint from 'typescript-eslint'
import hooks from 'eslint-plugin-react-hooks'
export default tseslint.config({ignores:['dist/**','test-results/**','playwright-report/**']}, ...tseslint.configs.recommended, {files:['**/*.{ts,tsx}'],plugins:{'react-hooks':hooks},rules:hooks.configs.recommended.rules})
