const fs = require('fs');
const path = require('path');

const apiRoot = path.resolve(__dirname, '..');
const outDir = path.resolve(apiRoot, '..', 'dist', 'api');

fs.mkdirSync(outDir, { recursive: true });
fs.copyFileSync(path.resolve(apiRoot, 'host.json'), path.resolve(outDir, 'host.json'));
fs.copyFileSync(path.resolve(apiRoot, 'package.json'), path.resolve(outDir, 'package.json'));
