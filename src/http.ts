
import Koa from 'koa';
import http from 'http';
import net from 'net';
import stream from 'stream';
import WebSocket from 'ws';
import _Server, {listen} from './server';


export abstract class Handler {
    abstract onRequest(ctx : Koa.Context) : Promise<void>;
    onConnect(s : WebSocket) : boolean {
        return false;
    };
}

export class Proxy extends Handler {
    private port : Promise<number>;

    constructor(server : _Server) {
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
                resolve();
            });

            ctx.req.pipe(proxyReq);
        });
    }
}

export class Server extends _Server {
    private httpServer : http.Server;
    private wsServer : WebSocket.Server;

    constructor(handlers : Handler[]) {
        super();

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
