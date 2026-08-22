import fs from 'fs';
let content = fs.readFileSync('backend/routes/roomRoutes.js', 'utf8');
content = content.replace('export default router;\n\n// Verify room password', '// Verify room password');
content += '\nexport default router;\n';
fs.writeFileSync('backend/routes/roomRoutes.js', content);
