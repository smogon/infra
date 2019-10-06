
import "make-promises-safe";
import "source-map-support/register";

import program from "commander";
import fs from 'fs';
import path from 'path';
// @ts-ignore
import opener from 'opener';
import * as build from "./build";
import Config from './config';
import Server, {listen} from './server';
import Worker from "./worker";
import Pauseable from './pauseable';
import Refreshable from "./refreshable";
import {sub} from './pubsub';
import * as http from './http';

function log(s : string) {
    console.log(`[${(new Date).toLocaleTimeString()}] ${s}`);
}

function requireConfig(opts : any) : Config {
    let config = opts.parent.config;
    try {
        let module = path.resolve(process.cwd(), config);
        return require(module);
    } catch(e) {
        console.error("Error loading configuration.\n");
        console.error(e.message);
        process.exit(1);
        throw new Error // TS doesn't know process.exit ends execution
    }
}

program.option('-c, --config <file>', 'Configuration file')

program
    .command('build')
    .action(async (opts) => {
        try {
            let config = requireConfig(opts);
            let o = await build.build(config);
            process.stdout.write(o);
        } catch(e) {
            process.stdout.write(e.message);
            process.exit(1);
        }
    });

program
    .command('start [args...]')
    .option('-p, --port <port>', 'Port')
    .option('--open-browser', 'Open browser')
    .option('--skip-build', 'Skip build')
    .option('--refresh', 'Refresh the browser on build')
    .action(async (args, opts) => {
        let config = requireConfig(opts);

        let {port=0, openBrowser=false, refresh=false, skipBuild=false} = opts;

        if (!skipBuild) {
            try {
                let o = await build.build(config);
                process.stdout.write(o);
            } catch(e) {
                process.stdout.write(e.message);
                process.exit(1);
            }
        }

        if (config.type !== 'js') {
            throw new Error('config type must be js');
        }

        let worker = new Worker(config.entryPoint, args);
        let pauseable = new Pauseable(worker);
        let refreshable = new Refreshable;

        // TODO: non-http servers
        let handlers : http.Handler[] = [new http.Proxy(pauseable)];

        if (refresh) {
            handlers.push(refreshable);
        }

        let server : Server = new http.Server(handlers);

        sub(config, (msg : string) => {
            if (msg === 'building' || msg === 'dead') {
                if (pauseable.running()) {
                    pauseable.pause();
                    refreshable.refresh();
                }
            } else if (msg === 'built') {
                worker.reload();
                if (pauseable.running()) {
                    // Missed a building notification
                    refreshable.refresh();
                } else {
                    pauseable.resume();
                }
            } else {
                process.stdout.write(`Unexpected message: ${msg}.`);
                process.exit(1);
            }
        });

        let serverPort = await listen(port, server);

        let address = `http://localhost:${serverPort}/`;
        log(`Listening on ${address}`);

        if (openBrowser) {
            opener(address);
        }
    });

program.parse(process.argv);

if (process.argv.slice(2).length === 0) {
    program.outputHelp();
}
