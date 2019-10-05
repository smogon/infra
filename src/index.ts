
import "make-promises-safe";
import "source-map-support/register";

import program from "commander";
import fs from 'fs';
import path from 'path';
// @ts-ignore
import opener from 'opener';
import * as build from "./build";
import Config from './config';
import Server from './server';
import Worker from "./worker";
import Pauseable from './pauseable';
import Refreshable from "./refreshable";
import {sub} from './pubsub';
import listen from './listen';

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

        let worker = new Worker(config.entryPoint, args);
        let pauseable = new Pauseable(worker);
        let server : Server = pauseable;

        let refreshable : Refreshable | null = null;
        if (refresh) {
            server = refreshable = new Refreshable(pauseable);;
        }

        sub(config, (msg : string) => {
            if (msg === 'building' || msg === 'dead') {
                if (pauseable.running()) {
                    pauseable.pause();
                    if (refreshable !== null) {
                        refreshable.refresh();
                    }
                }
            } else if (msg === 'built') {
                worker.reload();
                if (pauseable.running()) {
                    // Missed a building notification
                    if (refreshable !== null) {
                        refreshable.refresh();
                    }
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
