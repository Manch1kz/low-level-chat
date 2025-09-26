const net = require('net')
const readline = require('readline/promises')
const initName = require('./utils/init_name.js')
const { SessionGenerator } = require('./utils/session_generator.js')
var CryptoJS = require("crypto-js");

const name = initName()
const rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: `${name} >>> ` })
const server = net.connect({ host: 'localhost', port: 3000 })
const generator = new SessionGenerator()

let only_encrypted = false

rl.on('line', (line) => {
    if (line.length > 0) {
        process.stdout.moveCursor(0, -1)
        process.stdout.write('\r\x1B[K');
        console.log(`${name}: ${line}`)
        server.write(CryptoJS.AES.encrypt(JSON.stringify({type: 'msg', body: [name, line]}), generator.session_key).toString())
        rl.prompt()
    } else {
        process.stdout.moveCursor(0, -1)
        process.stdout.write('\r\x1B[K');
        rl.prompt()
    }
})

server.on('connect', () => {
    server.write(JSON.stringify({type: 'public_key_request', body: generator.getClient()}))
})

server.on('close', () => {
    server.end()
    process.exit()
})

server.on('data', async (data) => {
    const cur = rl.getCursorPos()
    let processed

    if (only_encrypted) {
        processed = JSON.parse(CryptoJS.AES.decrypt(data.toString(), generator.session_key).toString(CryptoJS.enc.Utf8))
    } else {
        processed = JSON.parse(data.toString('utf-8'))
    }
   
    switch (processed.type) {
        case 'public_key_response':
            generator.setServer(processed.body[1])
            server.write(JSON.stringify({type: 'master_key_response', body: [generator.getMaster(processed.body[0]), name]}))
            break;
        case 'finished':
            generator.generateSession()
            only_encrypted = true
            server.write(CryptoJS.AES.encrypt(JSON.stringify({type: "finished", body: name}), generator.session_key).toString())
            rl.prompt()
            break;
        case 'history':
            process.stdout.write('\r\x1B[K')

            for (let i = 0; i < processed.body.length; i++) {
                console.log(processed.body[i][0] + ':', processed.body[i][1])
            }

            console.log('[SERVER]:', name, 'подключился к серверу')

            rl.prompt(true)
            process.stdout.cursorTo(cur.cols)
            break;
        case 'msg':
            process.stdout.write('\r\x1B[K');
            console.log(processed.data[0] + ':', processed.data[1])

            rl.prompt(true)
            process.stdout.cursorTo(cur.cols)
            break;
    }
})

