export class ChatHistory {
    constructor() {
        this.chat = []
    }

    push(message) {
        if (this.chat.length >= 100) {
            this.chat.splice(0, 1)
        }
        this.chat.push(message)
    }

    getChat() {
        return this.chat
    }
}