
import fs from 'fs';
import cp from 'child_process';
import {Config} from './config';
import {pub} from './pubsub';
import {promisify} from 'util';

let exec = promisify(cp.exec);

export async function build(config : Config) {
    // Ensure build directory exists.
    try { fs.mkdirSync(config.buildDir) } catch(e) {};

    await pub(config, 'building');

    let r = "";
    try {
        if (config.buildCmd !== null) {
            let {stdout, stderr} = await exec(config.buildCmd,
                                              {cwd: config.rootDir});
            r = stdout + stderr;
        }
    } catch(e) {
        await pub(config, 'dead');
        throw e;
    }

    await pub(config, 'built');
    return r;
}
