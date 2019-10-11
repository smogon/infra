
// Multiple pub-sub with a file as the hub. This implementation sucks and can
// drop messages, but it is cross-platform, so...

import fs from 'fs';
import path from 'path';
// @ts-ignore
import * as safeFs from 'safe-read-write';
import {Config} from './config';

function getPath(config : Config) {
    return path.join(config.buildDir, ".smoginfra-pubsub");
}

export async function pub(config : Config, obj : any) {
    let text = JSON.stringify(obj);
    await safeFs.safeWrite(getPath(config), text);
}

export async function lastMessage(config : Config) {
    // Returns '' if doesn't exist
    let text = await safeFs.safeRead(getPath(config), 'utf8');
    if (text === '') {
        return null;
    } else {
        return JSON.parse(text);
    }
}

export function sub(config : Config, fn : (obj : any) => void) {
    let file = getPath(config);

    // Ensure it exists for watcher
    try { fs.closeSync(fs.openSync(file, 'wx')); } catch(e) {}

    let alreadyProcessingChange = false;

    fs.watch(file, {}, async (eventType) => {
        if (eventType === 'rename') {
            throw new Error('User damaged pubsub');
        }

        if (alreadyProcessingChange) {
            return;
        }

        alreadyProcessingChange = true;

        let msg = await lastMessage(config);

        fn(msg);

        alreadyProcessingChange = false;
    });
}
