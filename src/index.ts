import "./aliases"
import TelegramBot, { type User, Chat } from "node-telegram-bot-api"
import config from "./config"
import { TelegramCommand } from "@interfaces/telegram"
import {newClient} from '@services/wg';

export const COMMANDS: Array<string> = [TelegramCommand.Start, TelegramCommand.Manual, TelegramCommand.Help]

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
        if(query.message && query.data === config.inlineKeyboard.start[0][0].callback_data) this.vpn(query.from, query.message.chat)
        if(query.message && query.data === config.inlineKeyboard.done[0][0].callback_data) this.manual(query.message.chat)
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
      case TelegramCommand.Manual:
        return this.manual(chat)
      case TelegramCommand.Help:
        return this.sendMessage(chat, config.phrases.HELP_MESSAGE)
    }
  }

  private async vpn(from: User, chat: Chat) {
    try {
        const clientName = from.username || new Date().getTime().toString()
        const { file, qr } = await newClient(clientName)

        await this.bot.sendPhoto(chat.id, qr, {}, {filename: `fidar-vpn-${clientName}`})
        await this.bot.sendDocument(chat.id, file, {}, {filename: `fidar-vpn-${clientName}`})

        await new Promise(resolve => setTimeout(resolve, 1000))

        this.sendDoneMessage(chat)
    } catch (error: any) {
        console.error(error)
        this.sendMessage(chat, error.message || config.phrases.ERROR_MESSAGE)
    }
  }

  private async manual(chat: Chat) {
    this.sendManualMessage(chat)
  }

  private sendDoneMessage(chat: Chat) {
    this.bot.sendMessage(chat.id, config.phrases.DONE_MESSAGE, {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: config.inlineKeyboard.done
        }
      })
  }

  private sendManualMessage(chat: Chat) {
    this.bot.sendMessage(chat.id, config.phrases.MANUAL_MESSAGE, {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: config.inlineKeyboard.manual
        }
      })
  }

  private sendStartMessage(chat: Chat) {
    this.bot.sendMessage(chat.id, config.phrases.START_MESSAGE, {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: config.inlineKeyboard.start
        }
      })
  }

  private sendMessage(chat: Chat, message: string) {
    this.bot.sendMessage(chat.id, message)
  }

  private log(from: User, message: string) {
    console.log(from.username, message)
  }
}

new Telegram().process()