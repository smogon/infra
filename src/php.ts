
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
            ctx.body = new stream.PassThrough;
            let res = Object.create(
                ctx.body,
                {
                    setHeader: {
                        value(k : string, v : string) {
                            ctx.set(k, v);
                        },
                    },

                    statusCode: {
                        set(v : number) {
                            ctx.status = v;
                            resolve();
                        }
                    }
                }
            );
            cb(ctx.req, res);
        });
    }
}
