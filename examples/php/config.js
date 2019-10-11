
module.exports = {
    type : 'php',
    entryPoint : require('path').join(__dirname, 'index.php'),
    buildDir : require('path').join(__dirname, 'build'),
    async build() {
        return ''
    }
}
