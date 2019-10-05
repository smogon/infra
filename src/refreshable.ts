
import fs from 'fs';
// @ts-ignore
import trumpet from 'trumpet';
import WebSocket from 'ws';
import Koa from 'koa';

import {Handler} from './http';

let refreshJs = fs.readFileSync(`${__dirname}/../client/refresh-proxy.js`, 'utf8');
refreshJs = `<script type='text/javascript'>${refreshJs}</script>`;

export default class Refresher extends Handler {
    private sockets : Set<WebSocket>;

    constructor() {
        super();
        this.sockets = new Set;
    }

    async onRequest(ctx : Koa.Context) {
        if (ctx.response.get('Content-Type').startsWith('text/html')) {
            let tr = trumpet();
            let headStream = tr.select('head').createStream();
            headStream.write(refreshJs);
            headStream.pipe(headStream);
            ctx.body.pipe(tr);

            // Must be done before setting ctx.body, as Koa removes it...
            let len = ctx.response.length;

            ctx.body = tr;

            if (len > 0) {
                ctx.response.length = len + refreshJs.length;
            }
        }

        return;
    }

    onConnect(s : WebSocket){
        s.on('close', () => {
            this.sockets.delete(s);
        });
        this.sockets.add(s);
        return true;
    }

    refresh() {
        for (let ws of this.sockets) {
            ws.send('refresh');
        }
    }
}
