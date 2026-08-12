import { buildStyles } from './styles.mjs';
import fs from 'node:fs';
import path from 'node:path';
buildStyles();
const required=['index.html','app.js','styles.css','favicon.svg','manifest.webmanifest','sw.js','src/core.js','api/route.js','api/matrix.js','api/config.js','vercel.json'];
for(const file of required){const p=path.join(process.cwd(),file);if(!fs.existsSync(p)||fs.statSync(p).size===0)throw new Error(`Missing build artifact: ${file}`)}
const vercel=JSON.parse(fs.readFileSync('vercel.json','utf8'));
const out=path.join(process.cwd(),'dist');fs.rmSync(out,{recursive:true,force:true});fs.mkdirSync(out,{recursive:true});
for (const file of ['index.html','app.js','styles.css','favicon.svg','manifest.webmanifest','sw.js']) fs.copyFileSync(file,path.join(out,file)); fs.cpSync('src',path.join(out,'src'),{recursive:true}); fs.cpSync('api',path.join(out,'api'),{recursive:true}); fs.cpSync('data',path.join(out,'data'),{recursive:true}); fs.copyFileSync('vercel.json',path.join(out,'vercel.json'));
console.log('build: static assets + Vercel functions validated and copied to dist/');
