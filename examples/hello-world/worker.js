
let http = require('http');
let path = require('path');
let fs = require('fs');

let n = fs.readFileSync(path.join(__dirname, "build", "info.json"));

let server = http.createServer((req, res) => {
    res.writeHead(200, {'Content-Type': 'text/html'});
    res.end(`
    <html>
    <head></head>
    <body>
    Hello world. The build info is: <pre>${n}</pre>
    </body>
    </html>
    `);
});

process.on('message', (msg, h) => {
    if (msg === 'connection') {
        server.emit('connection', h);
    }
});
