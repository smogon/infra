
import "make-promises-safe";
import "source-map-support/register";

import program from "commander";
import fs from 'fs';
import path from 'path';
// @ts-ignore
import opener from 'opener';
import * as build from "./build";
import Config from './config';
import Acceptable, { listen } from './acceptable';
import {Worker, Process} from "./worker";
import Refreshable from "./refreshable";
import {sub} from './pubsub';
import PHPHandler from './php';
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

        let worker : Worker | null;
        // TODO: non-http servers
        let handlers : http.Handler[] = [];

        switch (config.type) {
            case 'js':
                worker = new Process(config.entryPoint, args);
                handlers.push(new http.Proxy(worker));
                break;
            case 'php':
                worker = null;
                handlers.push(new PHPHandler(config.entryPoint, args));
                break;
        }

        let refreshable = new Refreshable;
        if (refresh) {
            handlers.push(refreshable);
        }

        let server : Acceptable = new http.Server(handlers);

        sub(config, (msg : string) => {
            if (msg === 'building' || msg === 'dead') {
                if (worker !== null) {
                    void worker.shutdown();
                }
                refreshable.refresh();
            } else if (msg === 'built') {
                if (worker !== null) {
                    worker.reload();
                }
                refreshable.refresh();
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
