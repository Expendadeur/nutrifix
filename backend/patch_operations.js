const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'api', 'routes', 'operationsRoutes.js');
let content = fs.readFileSync(filePath, 'utf8');

// 1. POST /vehicules
content = content.replace(
    /(router\.post\('\/vehicules'.*?const \{.*?statut,\s*disponible)(\s*\} = req\.body;)/s,
    '$1,\n            photo$2'
);

// 2. PUT /vehicules/:id
content = content.replace(
    /(router\.put\('\/vehicules\/:id'.*?const \{.*?statut,\s*disponible)(\s*\} = req\.body;)/s,
    '$1,\n            photo$2'
);

// 3. POST /parcelles
content = content.replace(
    /(router\.post\('\/parcelles'.*?const \{.*?proprietaire,\s*loyer_annuel)(\s*\} = req\.body;)/s,
    '$1,\n            photo$2'
);

// 4. PUT /parcelles/:id
content = content.replace(
    /(router\.put\('\/parcelles\/:id'.*?const \{.*?proprietaire,\s*loyer_annuel)(\s*\} = req\.body;)/s,
    '$1,\n            photo$2'
);

fs.writeFileSync(filePath, content);
console.log('Patch applied successfully.');
