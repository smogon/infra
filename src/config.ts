
import path from 'path';
import JSON5 from 'json5';
import fs from 'fs';

type RunInfo = {
    type : 'js',
    entryPoint : string
} | {
    type : 'php',
    entryPoint : string
};

export type Config = {
    rootDir : string, // Inferred from config.js location
    buildDir : string,
    buildCmd : string | null,
    assets : {
        dir : string,
        mountPoint : string
    } | null
} & RunInfo;

export function load(configFile : string) : Config {
    let config = JSON5.parse(fs.readFileSync(configFile, 'utf8'));

    config.rootDir = path.dirname(configFile);

    config.entryPoint = path.resolve(config.rootDir, config.entryPoint);

    if (config.buildDir === undefined) {
        config.buildDir = "build";
    }
    config.buildDir = path.resolve(config.rootDir, config.buildDir);

    if (config.buildCmd === undefined) {
        config.buildCmd = null;
    }

    if (config.assets === undefined) {
        config.assets = null;
    } else {
        config.assets.dir = path.resolve(config.rootDir, config.assets.dir);
        config.assets.mountPoint = path.posix.join("/", config.assets.mountPoint, "/");
    }

    return config;
}
