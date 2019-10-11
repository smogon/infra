
import Koa from 'koa';
import http from 'http';
import net from 'net';
import stream from 'stream';
import WebSocket from 'ws';
import Acceptable, { listen } from './acceptable';
import send from 'koa-send';


export abstract class Handler {
    abstract onRequest(ctx : Koa.Context) : Promise<void>;
    onConnect(s : WebSocket) : boolean {
        return false;
    }
}

export class Proxy extends Handler {
    private port : Promise<number>;

    constructor(server : Acceptable) {
        super();
        this.port = listen(0, server);
    }

    async onRequest(ctx : Koa.Context) {
        if (ctx.body !== undefined) {
            throw new Error('Proxy must be the first Handler');
        }

        let port = await this.port;

        let options = {
            host: 'localhost',
            port: port,
            path: ctx.path,
            method: ctx.method,
            headers: ctx.header,
        };

        await new Promise((resolve, reject) => {
            let proxyReq = http.request(options, proxyRes => {
                ctx.status = proxyRes.statusCode as number;
                for (let [h, v] of Object.entries(proxyRes.headers)) {
                    ctx.set(h, v as string);
                }
                // setting proxyRes directly here seems to sometimes result in EPIPE.
                // There is a note about it in KoaJS documentation:
                // https://github.com/koajs/koa/blob/master/docs/api/response.md#stream
                ctx.body = proxyRes.pipe(new stream.PassThrough);
                ctx.type = ''; // We don't want application/octet-stream, which
                               // messes with Sendfile
                resolve();
            });

            ctx.req.pipe(proxyReq);
        });
    }
}


export class Sendfile extends Handler {
    async onRequest(ctx : Koa.Context) {
        let filename = ctx.response.get("X-Sendfile");
        if (filename !== '') {
            ctx.response.remove("X-Sendfile");
            await send(ctx, filename, {root : "/"});
        }
    }
}


export class Server implements Acceptable {
    private httpServer : http.Server;
    private wsServer : WebSocket.Server;

    constructor(handlers : Handler[]) {
        let app = new Koa;
        for (let handler of handlers) {
            app.use(async (ctx : Koa.Context, next) => {
                await handler.onRequest(ctx);
                await next();
            });
        }

        this.httpServer = http.createServer(app.callback());
        this.wsServer = new WebSocket.Server({server: this.httpServer});
        this.wsServer.on('connection', s => {
            for (let handler of handlers) {
                if (handler.onConnect(s)) {
                    return;
                }
            }

            // No handler.
            s.close();
        });
    }

    accept(s : net.Socket) {
        s.resume();
        this.httpServer.emit('connection', s);
    }
}
