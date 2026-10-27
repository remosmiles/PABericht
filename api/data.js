const fs = require('fs');
const path = require('path');

module.exports = (req, res) => {
  const clientCode = req.headers['x-access-code'];
  const serverCode = process.env.ACCESS_CODE;

  if (!serverCode) {
    return res.status(500).json({ error: 'Server-Fehler: ACCESS_CODE nicht gesetzt.' });
  }

  if (!clientCode || clientCode !== serverCode) {
    return res.status(401).json({ error: 'Ungültiger Zugangscode.' });
  }

  try {
    const dataPath = path.join(process.cwd(), 'data.json');
    const fileContents = fs.readFileSync(dataPath, 'utf8');
    const data = JSON.parse(fileContents);
    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ error: 'Fehler beim Laden der PA-Datenbank.' });
  }
};
