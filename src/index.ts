import "./aliases"
import {createClient } from '@api/index';
import TelegramBot, { type User, Chat } from "node-telegram-bot-api"

import logger from "@helpers/logger"

import { TelegramCommand } from "@interfaces/telegram"

import config from "./config"

export const COMMANDS: Array<string> = [TelegramCommand.Start, TelegramCommand.Manual, TelegramCommand.Help]

class Telegram {
  private bot = new TelegramBot(config.telegramToken, { polling: true })

  public process() {
    this.bot.on("message", msg => {
      const { from, chat, text } = msg
      if (!from || !text) return

      if (COMMANDS.includes(text)) return this.commands(from, chat, text)

      this.message(from, chat, text)
    })

    this.bot.on("callback_query", query => {
      if (query.message && query.data === config.inlineKeyboard.start[0][0].callback_data)
        this.vpn(query.from, query.message.chat)
      if (query.message && query.data === config.inlineKeyboard.done[0][0].callback_data)
        this.manual(query.message.chat)
    })
  }

  private message(from: User, chat: Chat, message: string) {
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
      const IP = '5.42.76.130'

      const userId = from.id
      const userName = from.username || userId

      const response = await createClient(IP, userId)
      if(!response.success) throw Error("Client creating error")

      if(response.already_exist) {
          this.sendMessage(chat, config.phrases.ALREADY_EXIST_MESSAGE)
          await new Promise(resolve => setTimeout(resolve, 1000))
      }

      await this.bot.sendDocument(chat.id, Buffer.from(response.conf, 'base64'), {}, {filename: `fídar-vpn-${userName}.conf`})
      await this.bot.sendPhoto(chat.id, Buffer.from(response.qr, 'base64'), {}, {filename: `fídar-vpn-${userName}`,})


      await new Promise(resolve => setTimeout(resolve, 1000))

      this.sendDoneMessage(chat)
    } catch (error: any) {
      console.error(error)
      this.sendMessage(chat, config.phrases.ERROR_MESSAGE)
    }
  }

  private manual(chat: Chat) {
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
    logger.debug(from.username, message)
  }
}

new Telegram().process()
