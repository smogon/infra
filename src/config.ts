
import path from 'path';

type RunInfo = {
    type : 'js',
    entryPoint : string
} | {
    type : 'php',
    entryPoint : string
}

export type Config = {
    buildDir : string,
    build() : Promise<string>
} & RunInfo;

export function load(configFile : string) : Config {
    let config = require(configFile);

    let configRoot = path.dirname(configFile);
    config.entryPoint = path.resolve(configRoot, config.entryPoint);
    if (config.buildDir === undefined) {
        config.buildDir = "build";
    }
    config.buildDir = path.resolve(configRoot, config.buildDir);

    return config;
}
