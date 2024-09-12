import "./aliases"
import TelegramBot, { type User, Chat } from "node-telegram-bot-api"
import config from "./config"
import { TelegramCommand } from "@interfaces/telegram"
import {newClient} from '@services/wg';

export const COMMANDS: Array<string> = [TelegramCommand.Start, TelegramCommand.Help]

class Telegram {
  private bot = new TelegramBot(config.telegramToken, { polling: true })

  public process() {
    this.bot.on("message", async msg => {
      const { from, chat, text } = msg
      if (!from || !text) return

      if (COMMANDS.includes(text)) return this.commands(from, chat, text)

      this.message(from, chat, text)
    })

    this.bot.on("callback_query", query => {
        if(query.message && query.data === config.inlineKeyboard[0][0].callback_data) this.vpn(query.message.chat)
    })
  }

  private async message(from: User, chat: Chat, message: string) {
    this.bot.sendChatAction(chat.id, "typing")

    this.log(from, `message - ${message}`)

    try {
        return this.sendStartMessage(chat)
    } catch (error) {
      console.error(error)
      this.sendMessage(chat, config.phrases.ERROR_MESSAGE)
    }
  }

  private commands(from: User, chat: Chat, action: string) {
    this.log(from, `command - ${action}`)

    switch (action) {
      case TelegramCommand.Start:
        return this.sendStartMessage(chat)
      case TelegramCommand.Help:
        return this.sendMessage(chat, config.phrases.HELP_MESSAGE)
    }
  }

  private sendMessage(chat: Chat, message: string) {
    this.bot.sendMessage(chat.id, message)
  }

  private sendStartMessage(chat: Chat) {
    this.bot.sendMessage(chat.id, config.phrases.START_MESSAGE, {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: config.inlineKeyboard
      }
    })
  }

  private async vpn(chat: Chat) {
    const qr = await newClient('test2')
    this.sendMessage(chat, qr || 'vpn')
  }

  private log(from: User, message: string) {
    console.log(from.username, message)
  }
}

new Telegram().process()