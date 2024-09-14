import "./aliases"
import { createClient, revokeClient } from "@api/index"
import TelegramBot, { type User, Chat, CallbackQuery, InlineKeyboardButton } from "node-telegram-bot-api"

import { entities } from "@root/database/data-source"

import { type Server } from "@database/entities/Server"
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

    this.bot.on("callback_query", query => this.callbackQuery(query))
  }

  private message(from: User, chat: Chat, message: string) {
    this.bot.sendChatAction(chat.id, "typing")
    this.log(from, `message - ${message}`)
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

  private async callbackQuery(query: CallbackQuery) {
    const {message, data, from} = query
    if(!message || !data || !from) return

    this.log(from, `callback query - ${data}`)

    const {chat} = message

    if (data === config.callbackData.location) {
      const servers = await entities.Server.find({ where: { active: true } })
      if(!servers) return logger.error("Servers not found")

      this.bot.deleteMessage(message.chat.id, message.message_id)
      return this.sendLocationMessage(chat, servers)
    }

    if (data.includes(config.callbackData.create)) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const [_, serverName] = data.split(":")

      if(serverName) this.create(from, chat, serverName, message.message_id)
    }

    if (data === config.callbackData.manual) {
      return this.manual(chat)
    }

    if (data === config.callbackData.subscription) {
      return this.subscription(from, chat)
    }

    if (data === config.callbackData.files) {
      return this.files(from, chat)
    }
  }

  private async create(from: User, chat: Chat, serverName: string, messageId: number) {
    try {
      const userId = from.id

      const client = await entities.Client.findOne({ where: { user_id: userId }, relations: { server: true } })
      if(client?.server) {
        const response = await revokeClient(client.server.ip, userId)
        if(!response?.success) {
          this.log(from, `❌ Error with client [${client.id}] deleting from [${serverName}]`)
          this.sendMessage(chat, config.phrases.SERVER_ERROR_MESSAGE)
          return
        }

        await entities.Client.delete({ user_id: userId })
      }

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

      await this.sendFiles(chat.id, from.username || from.id.toString(), response.conf, response.qr)

      this.bot.deleteMessage(chat.id, messageId)
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

  private async subscription(from: User, chat: Chat) {
    const client = await entities.Client.findOne({ where: { user_id: from.id }, relations: { server: true } })
    if(!client?.server) return this.sendNotFoundMessage(chat)

    this.sendSubscriptionMessage(chat, client?.server.label)
  }

  private async files(from: User, chat: Chat) {
    const userId = from.id

    const client = await entities.Client.findOne({ where: { user_id: from.id }, relations: { server: true } })
    if(!client?.server) return this.sendNotFoundMessage(chat)

    const response = await createClient(client.server.ip, userId)
    if (!response.success || !response.already_exist) throw Error("Find already created client")

      await this.sendFiles(chat.id, from.username || from.id.toString(), response.conf, response.qr)

      this.sendDoneMessage(chat)
  }

  private async sendFiles(chatId: number, userName: string, conf: string, qr: string,) {
    await this.bot.sendDocument(
      chatId,
      Buffer.from(conf, "base64"),
      {},
      { filename: `fídar-vpn-${userName}.conf` }
    )
    await this.bot.sendPhoto(chatId, Buffer.from(qr, "base64"), {}, { filename: `fídar-vpn-${userName}` })

    await new Promise(resolve => setTimeout(resolve, 1000))
  }


  private async saveClient(from: User, chatId: number, serverId: number) {
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

  private sendStartMessage(chat: Chat) {
    this.sendMessage(chat, config.phrases.START_MESSAGE, config.inlineKeyboard.start)
  }

  private sendLocationMessage(chat: Chat, servers: Array<Server>) {
    const data = servers.map(server => ({text: server.label, callback_data: `create:${server.name}`}))
    this.sendMessage(chat, config.phrases.LOCATION_MESSAGE, [data, [{ text: "📌 Моя подписка", callback_data: config.callbackData.subscription }]])
  }

  private sendDoneMessage(chat: Chat) {
    this.sendMessage(chat, config.phrases.DONE_MESSAGE, config.inlineKeyboard.done)
  }

  private sendManualMessage(chat: Chat) {
    this.sendMessage(chat, config.phrases.MANUAL_MESSAGE, config.inlineKeyboard.manual)
  }

  private sendNotFoundMessage(chat: Chat) {
    this.sendMessage(chat, config.phrases.NOT_FOUND_MESSAGE, config.inlineKeyboard.start)
  }

  private sendSubscriptionMessage(chat: Chat, serverLabel: string) {
    this.sendMessage(chat, `${config.phrases.SUBSCRIPTION_MESSAGE} ${serverLabel}`, config.inlineKeyboard.subscription)
  }

  private sendMessage(chat: Chat, message: string, inlineKeyboard?: Array<Array<InlineKeyboardButton>>) {
    if(!inlineKeyboard) return this.bot.sendMessage(chat.id, message)

    this.bot.sendMessage(chat.id, message, {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: inlineKeyboard
      }
    })
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
