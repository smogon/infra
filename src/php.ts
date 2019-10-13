
// Development only

// @ts-ignore
import cgi from 'cgi';
import Koa from 'koa';
import stream from 'stream';
import {Handler} from './http';

export default class PHPHandler extends Handler {
    private entryPoint : string;
    private args : string[];

    constructor(entryPoint : string, args : string[]) {
        super();
        this.entryPoint = entryPoint;
        this.args = args;
    }

    onRequest(ctx : Koa.Context) {
        let env = {
            // REDIRECT_STATUS necessary to satisfy cgi.force_redirect
            // https://www.php.net/manual/en/security.cgi-bin.attacks.php
            REDIRECT_STATUS: 200,
            // Even though we provide the entry point with -f, this is still
            // necessary or you will get "No input file specified"
            SCRIPT_FILENAME: this.entryPoint,
            REQUEST_URI: ctx.url,
        };

        let cb = cgi("php-cgi", {args: ["-f", this.entryPoint, "--", ...this.args],
                                 env,
                                 stderr: process.stderr});

        // Hack to make node HTTP callbacks play nicely with koa...
        //
        // This depends on the internals of node-cgi. Header parsing is finished
        // when statusCode is set.
        return new Promise<void>(resolve => {
            // (1)
            let res = Object.create(
                new stream.PassThrough,
                {
                    setHeader: {
                        value(k : string, v : string) {
                            ctx.set(k, v);
                        },
                    },

                    statusCode: {
                        set(v : number) {
                            ctx.status = v;
                            // Make sure to set `ctx.body` here and not at (1).
                            //
                            // Note that Koa will invoke `ctx.body.destroy()`
                            // when the response finishes. This can happen
                            // before resolve() is called if the request is
                            // cancelled. If a pipe happens in a tick after this
                            // destroy(), we will get ERR_STREAM_DESTROYED
                            // errors.
                            //
                            // cb will set up a pipe only after `statusCode` is
                            // set. So set `ctx.body` here.
                            ctx.body = res;
                            resolve();
                        }
                    }
                }
            );
            cb(ctx.req, res);
        });
    }
}
