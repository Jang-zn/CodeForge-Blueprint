import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = path.resolve(__dirname, '../src/dashboard');
const dest = path.resolve(__dirname, '../dist/dashboard');

fs.cpSync(src, dest, { recursive: true });
console.log('✓ Dashboard assets copied to dist/dashboard');

const templatesSrc = path.resolve(__dirname, '../src/templates');
const templatesDest = path.resolve(__dirname, '../dist/templates');
if (fs.existsSync(templatesSrc)) {
  fs.cpSync(templatesSrc, templatesDest, { recursive: true });
  console.log('✓ Template files copied to dist/templates');
}
