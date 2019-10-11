
import fs from 'fs';
import path from 'path';
import {Config} from './config';
import {pub} from './pubsub';

export async function build(config : Config) {
    // Ensure build directory exists.
    try { fs.mkdirSync(config.buildDir) } catch(e) {};

    await pub(config, 'building');

    let r;
    try {
        r = await config.build();
    } catch(e) {
        await pub(config, 'dead');
        throw e;
    }

    await pub(config, 'built');
    return r;
}
