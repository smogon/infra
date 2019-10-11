
let http = require('http');
let path = require('path');

let server = http.createServer((req, res) => {
    let filename = path.join(__dirname, "pokemon.jpg");
    res.writeHead(200, {'X-Sendfile': filename});
    res.end();
});

process.on('message', (msg, h) => {
    if (msg === 'connection') {
        server.emit('connection', h);
    }
});
