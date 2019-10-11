
module.exports = {
    type : 'php',
    entryPoint : "index.php",
    buildDir : require('path').join(__dirname, 'build'),
    async build() {
        return ''
    }
}
