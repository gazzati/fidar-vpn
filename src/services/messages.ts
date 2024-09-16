import TelegramBot from "node-telegram-bot-api"

import config from "@root/config"

import { Server } from "@database/entities/Server"

import type { User, Chat, InlineKeyboardButton } from "node-telegram-bot-api"

import DbService from "./db"

class MessageService {
  constructor(private bot: TelegramBot, private db: DbService) {}

  public async sendStart(from: User, chat: Chat) {
    const client = await this.db.getClient(from)

    const inlineKeyboard = [
      !client ? config.inlineKeyboardItem.trial : config.inlineKeyboardItem.subscription,
      config.inlineKeyboardItem.support
    ]

    this.sendMessage(chat, config.phrases.START_MESSAGE, inlineKeyboard)
  }

  public sendLocation(chat: Chat, servers: Array<Server>, exist: boolean) {
    const data = servers.map(server => ({ text: server.label, callback_data: `create:${server.name}` }))
    this.sendMessage(chat, exist ? config.phrases.LOCATION_WITH_EXIST_MESSAGE : config.phrases.LOCATION_MESSAGE, [
      data,
      exist ? config.inlineKeyboardItem.subscription : []
    ])
  }

  public async sendPay(from: User, chat: Chat) {
    const client = await this.db.getClient(from)
    if (!client) return this.sendMessage(chat, config.phrases.PAY_NEW_USER_MESSAGE, [config.inlineKeyboardItem.main])

    this.sendMessage(chat, config.phrases.PAY_MESSAGE, [
      ...config.inlineKeyboard.tariffs,
      config.inlineKeyboardItem.subscription
    ])
  }

  public sendSubscription(chat: Chat, serverLabel: string, paidUntil: string | null) {
    this.sendMessage(
      chat,
      `${config.phrases.SUBSCRIPTION_MESSAGE} ${serverLabel}\n💵└ Оплачено до: ${paidUntil || "-"}`,
      [config.inlineKeyboardItem.pay, config.inlineKeyboardItem.location, config.inlineKeyboardItem.files]
    )
  }

  public sendDone(chat: Chat) {
    this.sendMessage(chat, config.phrases.DONE_MESSAGE, config.inlineKeyboard.manual)
  }

  public sendManual(chat: Chat) {
    this.sendMessage(chat, config.phrases.MANUAL_MESSAGE, config.inlineKeyboard.manual)
  }

  public sendHelp(chat: Chat) {
    this.sendMessage(chat, config.phrases.HELP_MESSAGE)
  }

  public sendNotFound(chat: Chat) {
    this.sendMessage(chat, config.phrases.NOT_FOUND_MESSAGE, [config.inlineKeyboardItem.main])
  }

  public sendNeedPay(chat: Chat) {
    this.sendMessage(chat, config.phrases.NEED_PAY_MESSAGE, [config.inlineKeyboardItem.pay])
  }

  public sendSuccessfulPayment(chat: Chat) {
    this.sendMessage(chat, config.phrases.SUCCESSFUL_PAYMENT_MESSAGE, [config.inlineKeyboardItem.subscription])
  }

  public sendAlreadyExistError(chat: Chat) {
    this.sendMessage(chat, config.phrases.ALREADY_EXIST_MESSAGE)
  }

  public sendServerError(chat: Chat) {
    this.sendMessage(chat, config.phrases.ERROR_MESSAGE)
  }

  private sendMessage(chat: Chat, message: string, inlineKeyboard?: Array<Array<InlineKeyboardButton>>) {
    if (!inlineKeyboard) return this.bot.sendMessage(chat.id, message)

    this.bot.sendMessage(chat.id, message, {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: inlineKeyboard
      }
    })
  }
}

export default MessageService
