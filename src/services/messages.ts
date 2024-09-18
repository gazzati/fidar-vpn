import TelegramBot from "node-telegram-bot-api"

import config from "@root/config"
import { tgLogger } from "@root/helpers/logger"

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

  public sendLocations(chat: Chat, servers: Array<Server>) {
    const data = servers.map(server => ({
      text: server.label,
      callback_data: `${config.callbackData.changeServer}:${server.name}`
    }))
    this.sendMessage(chat, config.phrases.CHANGE_SERVER_MESSAGE, [data, config.inlineKeyboardItem.subscription])
  }

  public async sendPay(from: User, chat: Chat) {
    const client = await this.db.getClient(from)
    if (!client) return this.sendMessage(chat, config.phrases.PAY_NEW_USER_MESSAGE, [config.inlineKeyboardItem.trial, config.inlineKeyboardItem.support])

    this.sendMessage(chat, config.phrases.PAY_MESSAGE, [
      ...config.inlineKeyboard.tariffs,
      config.inlineKeyboardItem.subscription
    ])
  }

  public sendSubscription(chat: Chat, serverLabel: string, paidUntil: string | null, trialUser: boolean) {
    this.sendMessage(
      chat,
      `📌└ Статус подписки: ${trialUser ? "пробная" : "активная"} \n🌐└ Сервер: ${serverLabel}\n💵└ Оплачено до: ${
        paidUntil || "Просрочено"
      }`,
      [config.inlineKeyboardItem.pay, config.inlineKeyboardItem.locations, config.inlineKeyboardItem.files]
    )
  }

  public sendPromo(chat: Chat) {
    this.sendMessage(chat, config.phrases.SEND_PROMO_MESSAGE)
  }

  public sendPromoNotFound(chat: Chat) {
    this.sendMessage(chat, config.phrases.PROMO_NOT_FOUND_MESSAGE)
  }

  public sendDone(chat: Chat) {
    this.sendMessage(chat, config.phrases.DONE_MESSAGE, [config.inlineKeyboardItem.manual, config.inlineKeyboardItem.main])
  }

  public sendManual(chat: Chat) {
    this.sendMessage(chat, config.phrases.MANUAL_MESSAGE, config.inlineKeyboard.manual)
  }

  public sendHelp(chat: Chat) {
    this.sendMessage(chat, config.phrases.HELP_MESSAGE)
  }

  public sendSubscriptionNotFound(from: User, chat: Chat) {
    this.sendMessage(chat, config.phrases.SUBSCRIPTION_NOT_FOUND_MESSAGE, [
      config.inlineKeyboardItem.trial,
      config.inlineKeyboardItem.support
    ])
    tgLogger.error(from, "User not found")
  }

  public sendNeedPay(chat: Chat) {
    this.sendMessage(chat, config.phrases.NEED_PAY_MESSAGE, [config.inlineKeyboardItem.pay])
  }

  public sendSuccessfulPayment(chat: Chat, paidUntil: string | null) {
    this.sendMessage(chat, `${config.phrases.SUCCESSFUL_PAYMENT_MESSAGE}\n\nВаша подписка продлена до ${paidUntil}`, [
      config.inlineKeyboardItem.subscription,
      config.inlineKeyboardItem.locations,
      config.inlineKeyboardItem.main
    ])
  }

  public sendSuccessfulPromo(chat: Chat, paidUntil: string | null) {
    this.sendMessage(chat, `${config.phrases.SUCCESSFUL_PROMO_MESSAGE}\n\nВаша подписка продлена до ${paidUntil}`, [
      config.inlineKeyboardItem.subscription,
      config.inlineKeyboardItem.locations,
      config.inlineKeyboardItem.main
    ])
  }

  public sendServerError(chat: Chat) {
    this.sendMessage(chat, config.phrases.ERROR_MESSAGE, [config.inlineKeyboardItem.main])
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
