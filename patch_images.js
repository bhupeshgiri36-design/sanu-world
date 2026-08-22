import fs from 'fs';

let content = fs.readFileSync('frontend/src/components/Landing.jsx', 'utf8');
content = content.replace(/\/image\.png/g, '/sanu-profile.jpg');
content = content.replace(/onError=\{\(e\) => \{ e\.target\.src='https:\/\/images\.unsplash\.com[^']*'; \}\}/g, '');
fs.writeFileSync('frontend/src/components/Landing.jsx', content);
