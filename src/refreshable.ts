
import fs from 'fs';
import http from 'http';
import url from 'url';
import net from 'net';
// @ts-ignore
import trumpet from 'trumpet';
import WebSocket from 'ws';

import Server from './server';
import listen from './listen';

let refreshJs = fs.readFileSync(`${__dirname}/../client/refresh-proxy.js`, 'utf8');
refreshJs = `<script type='text/javascript'>${refreshJs}</script>`;

function rewrite(fromRes : http.IncomingMessage, toRes : http.ServerResponse) {
    let {statusCode, headers} = fromRes;
    
    if (headers['content-type'] !== undefined &&
        headers['content-type'].startsWith('text/html')) {
        let tr = trumpet();
        let headStream = tr.select('head').createStream();
        headStream.write(refreshJs);
        headStream.pipe(headStream);

        if (headers['content-length'] !== undefined) {
            headers['content-length'] += refreshJs.length;
        }

        toRes.writeHead(statusCode as number, headers);
        fromRes.pipe(tr).pipe(toRes);
    } else {
        toRes.writeHead(statusCode as number, headers);
        fromRes.pipe(toRes);
    }
}

export default class Refreshable extends Server {
    // public address : any = undefined;
    private port : Promise<number>;
    private wsServer : WebSocket.Server;
    private httpServer : http.Server;
    
    constructor(server : Server) {
        super();
        this.port = listen(0, server);
        this.httpServer = http.createServer((req, res) => this.onRequest(req, res));
        this.wsServer = new WebSocket.Server({server: this.httpServer});
    }

    accept(s : net.Socket) {
        s.resume();
        this.httpServer.emit('connection', s);
    }

    async onRequest(req : http.IncomingMessage, res : http.ServerResponse) {
        let port = await this.port;
        
        let reqInfo = url.parse(req.url as string);
        let options = {
            host: 'localhost',
            port: port,
            path: reqInfo.path,
            method: req.method,
            headers: req.headers,
        };

        let proxyReq = http.request(options,
                                    proxyRes => rewrite(proxyRes, res));

        req.pipe(proxyReq);
    }

    refresh() {
        for (let ws of this.wsServer.clients) {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send('refresh');
            }
        }
    }
}



