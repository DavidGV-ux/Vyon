import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const OUT = '/Users/davidgalvis/Documents/Vyon/docs/screenshots'
mkdirSync(OUT, { recursive: true })
const BASE = 'http://127.0.0.1:3098'

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await ctx.newPage()

async function shot(name, path, wait = 1500) {
  await page.goto(BASE + path, { waitUntil: 'networkidle' })
  await page.waitForTimeout(wait)
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true })
  console.log('saved', name)
}

await shot('landing', '/')
await shot('login', '/login')
await shot('register', '/register')

await browser.close()
console.log('done')
