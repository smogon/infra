
let fs = require('fs');

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function build() {
    let rand = {rand: Math.random()}
    await sleep(3000); // Artificial delay
    await fs.promises.writeFile("build/info.json",
                                JSON.stringify(rand));
}

build();
