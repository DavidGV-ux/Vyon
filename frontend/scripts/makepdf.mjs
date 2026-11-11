import { chromium } from 'playwright'
import { readFileSync, writeFileSync } from 'node:fs'

const DIR = '/Users/davidgalvis/Documents/Vyon/docs/screenshots'
const b64 = (name) => readFileSync(`${DIR}/${name}.png`).toString('base64')

let html = readFileSync('/Users/davidgalvis/Documents/Vyon/docs/tareas/reporte.html', 'utf8')
html = html.replace('PLACEHOLDER_LANDING', b64('landing'))
html = html.replace('PLACEHOLDER_LOGIN', b64('login'))
html = html.replace('PLACEHOLDER_REGISTER', b64('register'))
html = html.replace('PLACEHOLDER_HEALTH', b64('api-health'))

writeFileSync('/Users/davidgalvis/Documents/Vyon/docs/tareas/reporte-final.html', html)

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()
await page.setContent(html, { waitUntil: 'load' })
await page.pdf({
  path: '/Users/davidgalvis/Documents/Vyon/docs/tareas/reporte-vyon-tareas.pdf',
  format: 'A4',
  printBackground: true,
  margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' },
})
await browser.close()
console.log('PDF generated')
