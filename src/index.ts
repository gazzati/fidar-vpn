import "./aliases"
import { createClient } from "@api/index"
import TelegramBot, { type User, Chat } from "node-telegram-bot-api"

import { entities } from "@root/database/data-source"

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
      if (query.message && query.data === config.inlineKeyboard.done[0][0].callback_data) {
        this.log(query.from, `manual`)
        this.manual(query.message.chat)
      }
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
      const userId = from.id
      const userName = from.username || userId

      const serverName = "sw0"
      const server = await entities.Server.findOne({ where: { name: serverName } })
      if (!server?.ip) {
        this.log(from, `❌ Server [${serverName}] not found`)
        this.sendMessage(chat, config.phrases.SERVER_ERROR_MESSAGE)
        return
      }

      const response = await createClient(server.ip, userId)
      if (!response.success) throw Error("Client creating error")

      if (response.already_exist) {
        this.sendMessage(chat, config.phrases.ALREADY_EXIST_MESSAGE)
        await new Promise(resolve => setTimeout(resolve, 1000))
      }

      await this.bot.sendDocument(
        chat.id,
        Buffer.from(response.conf, "base64"),
        {},
        { filename: `fídar-vpn-${userName}.conf` }
      )
      await this.bot.sendPhoto(chat.id, Buffer.from(response.qr, "base64"), {}, { filename: `fídar-vpn-${userName}` })

      await new Promise(resolve => setTimeout(resolve, 1000))

      this.sendDoneMessage(chat)

      this.log(from, `✅ Client created server [${serverName}]`)

      this.saveClient(from, chat.id, server.id)
    } catch (error: any) {
      console.error(error)
      this.sendMessage(chat, config.phrases.ERROR_MESSAGE)
    }
  }

  private manual(chat: Chat) {
    this.sendManualMessage(chat)
  }

  private async saveClient(from: User, chatId, serverId: number) {
    const client = await entities.Client.findOne({ where: { user_id: from.id, server: { id: serverId } } })
    if (!client) {
      await entities.Client.save({
        user_id: from.id,
        chat_id: chatId,
        server: { id: serverId },
        ...(from.username && { username: from.username }),
        ...(from.first_name && { first_name: from.first_name }),
        ...(from.last_name && { last_name: from.last_name })
      })
    }
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
    const userDetails =
      from.first_name || from.last_name
        ? ` (${from.first_name || ""}${from.last_name ? ` ${from.last_name}` : ""})`
        : ""
    const user = `👨‍💻 @${from.username}${userDetails}`

    logger.debug(user, message)
  }
}

new Telegram().process()
