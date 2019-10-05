
export default interface Config {
    type : 'js',
    buildDir : string,
    entryPoint : string,
    build() : Promise<string>
}
