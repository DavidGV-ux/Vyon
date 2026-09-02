const express = require('express')
const path = require('path')

const app = express()
const distDir = path.join(__dirname, 'dist')

app.use(express.static(distDir))

app.get('*', (_req, res) => {
  res.sendFile(path.join(distDir, 'index.html'))
})

const PORT = process.env.PORT || 3000

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`VYON mockup running on http://localhost:${PORT}`)
  })
}

module.exports = app
