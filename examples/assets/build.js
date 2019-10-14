#!/usr/bin/env node

let crypto = require('crypto');
let fs = require('fs');

let contents = fs.readFileSync('./pokemon.jpg');

let hash = crypto.createHash('sha1').update(contents).digest('hex');

try { fs.mkdirSync('build/assets'); } catch(e) {}

fs.writeFileSync(`build/assets/pokemon-${hash}.jpg`, contents);
fs.writeFileSync('build/hash.txt', hash);
