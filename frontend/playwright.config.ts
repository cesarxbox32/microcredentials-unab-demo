import {defineConfig} from '@playwright/test'

const baseURL='http://127.0.0.1:4173/microcredentials-unab/'
export default defineConfig({
  testDir:'./e2e',
  use:{baseURL,viewport:{width:1440,height:1050},
    launchOptions:{executablePath:process.env.MICROCRED_CHROMIUM}},
  webServer:{command:'node e2e/serve-dist.mjs',url:baseURL},
})
