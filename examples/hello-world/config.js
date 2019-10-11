
let path = require('path');
let fs = require('fs');

let buildDir = path.join(__dirname, "build");

exports.type = 'js';

exports.buildDir = buildDir;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function build() {
    let rand = {rand: Math.random()}
    await sleep(3000); // Artificial delay
    await fs.promises.writeFile(path.join(buildDir, "info.json"),
                                JSON.stringify(rand));
    return '';
}

exports.build = build;

exports.entryPoint = "worker.js";
