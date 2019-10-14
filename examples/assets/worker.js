
let http = require('http');
let path = require('path');
let fs = require('fs');

let server = http.createServer((req, res) => {
    if (req.url === '/') {
        let hash = fs.readFileSync(path.join(__dirname, 'build', 'hash.txt'), 'utf8');
        res.writeHead(302, {'Location': `/assets/pokemon-${hash}.jpg`});
        res.end();
    } else {
        res.writeHead(404, {'Content-Type': 'text/plain'});
        res.end('Hmm? You should not be seeing this.');
    }
});

process.on('message', (msg, h) => {
    if (msg === 'connection') {
        server.emit('connection', h);
    }
});
