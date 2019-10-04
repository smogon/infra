
export default interface Config {
    buildDir : string,
    entryPoint : string,
    build() : Promise<string>
}
