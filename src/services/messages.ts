import TelegramBot from "node-telegram-bot-api"

import config from "@root/config"
import { tgLogger } from "@root/helpers/logger"
import { buildCallbackData, CallbackAction } from "@root/telegram/callback-data"
import { CardTariff, PayMethod, StarsTariff, TariffName } from "@interfaces/pay"

import { Server } from "@database/entities/Server"

import type { User, Chat, InlineKeyboardButton } from "node-telegram-bot-api"

import DbService from "./db"

class MessageService {
  constructor(private bot: TelegramBot, private db: DbService, private waitingPromoIds: Array<number>) {}

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
      callback_data: buildCallbackData(CallbackAction.ChangeServer, server.name)
    }))
    this.sendMessage(chat, config.phrases.CHANGE_SERVER_MESSAGE, [data, config.inlineKeyboardItem.subscription])
  }

  public async sendPay(from: User, chat: Chat) {
    const client = await this.db.getClient(from)
    if (!client)
      return this.sendMessage(chat, config.phrases.PAY_NEW_USER_MESSAGE, [
        config.inlineKeyboardItem.trial,
        config.inlineKeyboardItem.support
      ])

    this.sendMessage(chat, config.phrases.PAY_MESSAGE, [
      config.inlineKeyboardItem.payCard,
      config.inlineKeyboardItem.payStars,
      config.inlineKeyboardItem.subscription
    ])
  }

  public sendPayTariffs(chat: Chat, method: PayMethod) {
    const isCard = method === PayMethod.Card
    const tariffAction = isCard ? CallbackAction.TariffCard : CallbackAction.TariffStars
    const currencySymbol = isCard ? "₽" : "⭐"
    const message = isCard ? config.phrases.PAY_CARD_MESSAGE : config.phrases.PAY_STARS_MESSAGE
    const tariffs = isCard ? CardTariff : StarsTariff

    this.sendMessage(chat, message, [
      [{ text: `${tariffs.Month}${currencySymbol} - ${TariffName.Month}`, callback_data: buildCallbackData(tariffAction, tariffs.Month) }],
      [{ text: `${tariffs.Month3}${currencySymbol} - ${TariffName.Month3}`, callback_data: buildCallbackData(tariffAction, tariffs.Month3) }],
      [{ text: `${tariffs.Year}${currencySymbol} - ${TariffName.Year}`, callback_data: buildCallbackData(tariffAction, tariffs.Year) }],
      config.inlineKeyboardItem.promo,
      config.inlineKeyboardItem.pay
    ])
  }

  public sendSubscription(chat: Chat, serverLabel: string, paidUntil: string | null, active: boolean) {
    this.sendMessage(
      chat,
      `📌└ Статус подписки: ${active ? "активная" : "не активная"} \n🌐└ Сервер: ${serverLabel}\n💵└ Оплачено до: ${
        paidUntil || "Просрочено"
      }`,
      [
        config.inlineKeyboardItem.pay,
        config.inlineKeyboardItem.locations,
        config.inlineKeyboardItem.files,
        config.inlineKeyboardItem.manual
      ]
    )
  }

  public sendPromo(chat: Chat) {
    if (!this.waitingPromoIds.includes(chat.id)) this.waitingPromoIds.push(chat.id)
    this.sendMessage(chat, config.phrases.SEND_PROMO_MESSAGE)
  }

  public sendPromoNotFound(chat: Chat) {
    this.sendMessage(chat, config.phrases.PROMO_NOT_FOUND_MESSAGE)
  }

  public sendDone(chat: Chat) {
    this.sendMessage(chat, config.phrases.DONE_MESSAGE, [
      config.inlineKeyboardItem.manual,
      config.inlineKeyboardItem.main
    ])
  }

  public sendManual(chat: Chat) {
    this.sendMessage(chat, config.phrases.MANUAL_MESSAGE, config.inlineKeyboard.manual)
  }

  public sendHelp(chat: Chat) {
    this.sendMessage(chat, config.phrases.HELP_MESSAGE)
  }

  public sendSubscriptionNotFound(from: User, chat: Chat) {
    this.sendMessage(chat, config.phrases.SUBSCRIPTION_NOT_FOUND_MESSAGE, [
      config.inlineKeyboardItem.main,
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
