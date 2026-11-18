const fs = require('fs');
const path = require('path');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    const { nombre, email, empresa, mensaje } = req.body;

    if (!nombre || !email || !mensaje) {
      return res.status(400).json({ error: 'Faltan campos requeridos' });
    }

    const insercion = {
      id: Date.now().toString(),
      fecha: new Date().toISOString(),
      nombre,
      email,
      empresa: empresa || '',
      mensaje
    };

    const dataDir = '/tmp';
    const dataFile = path.join(dataDir, 'contactos.json');

    let existentes = [];
    try {
      if (fs.existsSync(dataFile)) {
        existentes = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
      }
    } catch (e) {
      existentes = [];
    }

    existentes.push(insercion);
    fs.writeFileSync(dataFile, JSON.stringify(existentes, null, 2));

    return res.status(200).json({ ok: true, message: 'Inserción guardada' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};
