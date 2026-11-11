import { chromium } from 'playwright'
const OUT = '/Users/davidgalvis/Documents/Vyon/docs/screenshots'
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await page.goto('http://127.0.0.1:3000/api/v1/health', { waitUntil: 'networkidle' })
await page.waitForTimeout(1000)
await page.screenshot({ path: `${OUT}/api-health.png`, fullPage: true })
console.log('saved api-health')
await browser.close()
