import sharp from 'sharp';
import {readFile,mkdir} from 'node:fs/promises';
const root=new URL('../frontend/',import.meta.url);
const svg=await readFile(new URL('assets/icons/app-icon.svg',root));
await mkdir(new URL('assets/icons/',root),{recursive:true});
for(const [path,size] of [['apple-touch-icon.png',180],['assets/icons/icon-192.png',192],['assets/icons/icon-512.png',512],['assets/icons/icon-maskable-512.png',512],['assets/icons/favicon-32.png',32]]){
  await sharp(svg).resize(size,size).flatten({background:'#101e2b'}).png().toFile(new URL(path,root).pathname);
}
