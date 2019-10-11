
type RunInfo = {
    type : 'js',
    entryPoint : string
} | {
    type : 'php',
    entryPoint : string
}

type Config = {
    buildDir : string,
    build() : Promise<string>
} & RunInfo;

export default Config;
