const net = require('net')
const { ChatHistory } = require('./utils/history.js')
const { SessionGenerator } = require('./utils/session_generator.js')
var CryptoJS = require("crypto-js");

const connections = new Map()

const history = new ChatHistory()
const server = net.createServer()
const generator = new SessionGenerator()

function processMessage(socket, data) {
    const socket_item = connections.get(socket)
    const socket_generator = socket_item.generator
    let message

    if (socket_item.only_encrypted) {
        message = JSON.parse(CryptoJS.AES.decrypt(data.toString(), socket_item.generator.session_key).toString(CryptoJS.enc.Utf8))
    } else {
        message = JSON.parse(data.toString())
    }

    switch (message.type) {
        case 'msg':
            history.push(message.body)
            connections.keys().forEach(i => {
                if (i != socket) {
                    i.write(CryptoJS.AES.encrypt(JSON.stringify({type: 'msg', data: message.body}), connections.get(i).generator.session_key).toString())
                }
            })
            break;
        case 'public_key_request':
            const server_random = generator.getServer()

            socket_generator.setClient(message.body)
            socket_generator.setServer(server_random)

            socket.write(JSON.stringify({type: 'public_key_response', body: [generator.publicKey, server_random]}))
            break;
        case 'master_key_response':
            socket_generator.setMaster(message.body[0], generator.privateKey)
            socket_generator.generateSession()
            socket_item.name = message.body[1]
            socket_item.only_encrypted = true

            socket.write(JSON.stringify({type: 'finished'}))
            break;
        case 'finished': 
            socket_item.name = message.body
            socket.write(CryptoJS.AES.encrypt(JSON.stringify({type: 'history', body: history.getChat()}), socket_generator.session_key).toString())
            history.push(['[SERVER]', message.body + ' подключился к серверу'])

            connections.keys().forEach(i => {
                if (i != socket) {
                    i.write(CryptoJS.AES.encrypt(JSON.stringify({type: 'msg', data: ['[SERVER]', message.body + ' подключился к серверу']}), connections.get(i).generator.session_key).toString())
                }
            })

            break;
        
    }
}

function setupSocket(socket) {
    connections.set(socket, {name: null, generator: new SessionGenerator(), only_encrypted: false})

    socket.on('close', () => {
        let body = ['[SERVER]', connections.get(socket).name + ' отключился от сервера']
        history.push(body)

        connections.keys().forEach(i => {
            i.write(CryptoJS.AES.encrypt(JSON.stringify({type: 'msg', data: body}), connections.get(i).generator.session_key).toString())
        })
        connections.delete(socket)
    })

    socket.on('error', () => {
        let body = ['[SERVER]', connections.get(socket).name + ' отключился от сервера']
        history.push(body)

        connections.keys().forEach(i => {
            i.write(CryptoJS.AES.encrypt(JSON.stringify({type: 'msg', data: body}), connections.get(i).generator.session_key).toString())
        })
        connections.delete(socket)
    })

    socket.on('data', (data) => {
        processMessage(socket, data)
    })
}

server.on('connection', (socket) => {
    setupSocket(socket)
})

server.listen(3000)