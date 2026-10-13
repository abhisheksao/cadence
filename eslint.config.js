// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*", "coverage/*", "android/*", "ios/*", ".expo/*"],
  },
  {
    // OEM system fonts clip text measured with Roboto; @/components/Text sets the family.
    files: ["src/**/*.tsx"],
    ignores: ["src/components/Text.tsx", "src/**/*.test.tsx"],
    rules: {
      "no-restricted-imports": ["error", {
        paths: [{
          name: "react-native",
          importNames: ["Text", "TextInput"],
          message: "Import Text and TextInput from '@/components/Text' (OnePlus font clipping).",
        }],
      }],
    },
  },
]);
