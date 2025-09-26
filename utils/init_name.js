function initName() {
    if (process.argv[2] == "--name" && process.argv[3]) {
        return process.argv[3]
    } else {
        return require('crypto').randomBytes(8).toString('hex')
    }
}

module.exports = initName