
import Koa from 'koa';
import http from 'http';
import net from 'net';
import stream from 'stream';
import WebSocket from 'ws';
import Acceptable, { listen } from './acceptable';
import send from 'koa-send';
import path from 'path';


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

                let type = ctx.type;

                // setting proxyRes directly here seems to sometimes result in EPIPE.
                // There is a note about it in KoaJS documentation:
                // https://github.com/koajs/koa/blob/master/docs/api/response.md#stream
                ctx.body = proxyRes.pipe(new stream.PassThrough);

                // If !type before setting body, it was changed to application/octet-stream...
                ctx.type = type;

                resolve();
            });

            // If the connection hangs before upstream responds, and upstream is
            // killed (perhaps by a build), then we will get a socket hangup
            // exception thrown which will take down infra. Catch it here and
            // reject the promise.
            proxyReq.on('error', (err) => {
                reject(err);
            });

            ctx.req.pipe(proxyReq);
        });
    }
}


export class Assets extends Handler {
    constructor(opts: {dir: string,
                       mountPoint: string},
                _next : Handler,
                private next = _next,
                private dir = opts.dir,
                private mountPoint = opts.mountPoint) {
        super();
    }

    async onRequest(ctx : Koa.Context) {
        if (ctx.path.startsWith(this.mountPoint)) {
            let rest = ctx.path.slice(this.mountPoint.length);
            let filename = path.posix.join(this.dir, rest);
            // For more info, see https://www.keycdn.com/blog/cache-control-immutable
            ctx.set('Cache-Control', 'public, max-age=31536000, immutable');
            await send(ctx, filename, { root : "/" });
        } else {
            return this.next.onRequest(ctx);
        }
    }

    onConnect(s : WebSocket) {
        return this.next.onConnect(s);
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

        app.use(async (ctx, next) => {
            // Normalize paths by locally resolving {.,..} and collapsing
            // forward slashes
            ctx.path = path.posix.normalize(ctx.path);
            await next();
        });

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
