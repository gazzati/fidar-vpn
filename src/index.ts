import "./aliases"
import { createClient, disableClient } from "@api/server"
import TelegramBot, { type User, Chat, CallbackQuery } from "node-telegram-bot-api"

import { getNewExpiredAt, dbDate, getSubscriptionExpiredDate } from "@helpers/date"
import { tgLogger } from "@helpers/logger"
import DbService from "@services/db"
import MessageService from "@services/messages"
import PaymentService from "@services/payment"

import { PayTariff } from "@interfaces/pay"
import { TelegramCommand } from "@interfaces/telegram"

import config from "./config"

export const COMMANDS: Array<string> = [
  TelegramCommand.Start,
  TelegramCommand.Subscription,
  TelegramCommand.Pay,
  TelegramCommand.Help
]

class Telegram {
  private bot = new TelegramBot(config.telegramToken, { polling: true })

  private db = new DbService()
  private messages = new MessageService(this.bot, this.db)
  private payment = new PaymentService(this.bot, this.db, this.messages)

  public process() {
    this.bot.on("message", msg => {
      const { from, chat, text } = msg
      if (!from || !text) return

      if (COMMANDS.includes(text)) return this.commands(from, chat, text)

      this.promo(from, chat, text)
    })

    this.bot.on("callback_query", query => this.callbackQuery(query))
    this.bot.on("pre_checkout_query", query => this.payment.preCheckoutQuery(query))
    this.bot.on("successful_payment", message => this.payment.successfulPayment(message))
  }

  private commands(from: User, chat: Chat, action: string) {
    tgLogger.log(from, `📋 Command ${action}`)

    switch (action) {
      case TelegramCommand.Start:
        return this.messages.sendStart(from, chat)
      case TelegramCommand.Subscription:
        return this.subscription(from, chat)
      case TelegramCommand.Pay:
        return this.messages.sendPay(from, chat)
      case TelegramCommand.Help:
        return this.messages.sendHelp(chat)
    }
  }

  private async callbackQuery(query: CallbackQuery) {
    const { message, data, from } = query
    if (!message || !data || !from) return

    tgLogger.log(from, `🤙 Callback-query ${data}`)

    const { chat } = message

    switch (data) {
      case config.callbackData.start:
        return this.start(from, chat, message.message_id)
      case config.callbackData.trial:
        return this.trial(from, chat, message.message_id)
      case config.callbackData.locations:
        return this.locations(from, chat, message.message_id)
      case config.callbackData.files:
        return this.files(from, chat, message.message_id)
      case config.callbackData.subscription:
        return this.subscription(from, chat, message.message_id)

      case config.callbackData.support:
        return this.messages.sendHelp(chat)
      case config.callbackData.manual:
        return this.messages.sendManual(chat)
      case config.callbackData.pay:
        return this.messages.sendPay(from, chat)
      case config.callbackData.promo:
        return this.messages.sendPromo(chat)
    }

    if (data.includes(config.callbackData.changeServer)) {
      const [, serverName] = data.split(":")
      if (!serverName) return this.error(from, chat, "serverName is required")

      return await this.changeServer(from, chat, serverName, message.message_id)
    }

    if (data.includes(config.callbackData.tariff)) {
      const [, tariff] = data.split(":") as [any, PayTariff]
      if (!tariff) return tgLogger.error(from, "Tariff not found")

      await this.payment.invoice(from, chat, Number(tariff))
    }
  }

  private async start(from: User, chat: Chat, messageId: number) {
    await this.messages.sendStart(from, chat)
    return this.bot.deleteMessage(chat.id, messageId)
  }

  private async trial(from: User, chat: Chat, messageId: number) {
    try {
      const server = await this.db.getDefaultServer()
      if (!server?.ip) return this.error(from, chat, "Default server not found")

      const response = await createClient(server.ip, from.id)
      if (!response.success) return this.error(from, chat, `Client creation error server [${server.name}]`)

      await this.sendFiles(chat.id, from.username || from.id.toString(), server.name, response.conf, response.qr)

      this.messages.sendDone(chat)
      this.bot.deleteMessage(chat.id, messageId)

      tgLogger.log(from, `✅ Client created server [${server.name}]`)

      return this.db.saveClient(from, chat, server.id, response.public_key)
    } catch (error: any) {
      this.error(from, chat, error.message)
    }
  }

  private async locations(from: User, chat: Chat, messageId: number) {
    const client = await this.db.getClientWithServer(from)
    if (!client) return this.messages.sendSubscriptionNotFound(from, chat)

    const servers = await this.db.getServersForClient(client)
    if (!servers) return this.error(from, chat, "Servers not found")

    this.messages.sendLocations(chat, servers)
    return this.bot.deleteMessage(chat.id, messageId)
  }

  private async changeServer(from: User, chat: Chat, serverName: string, messageId: number) {
    try {
      const server = await this.db.getServer(serverName)
      if (!server?.ip) return this.error(from, chat, `Server [${serverName}] not found`)

      const client = await this.db.getClientWithServer(from)
      if (!client) return this.messages.sendSubscriptionNotFound(from, chat)

      const expired = new Date() > new Date(client.expired_at)
      if (expired) {
        tgLogger.log(from, `💵 Not paid`)
        this.messages.sendNeedPay(chat)
        return
      }

      const response = await createClient(server.ip, from.id)
      if (!response.success) return this.error(from, chat, `Client creation error server [${server.name}]`)

      await this.sendFiles(chat.id, from.username || from.id.toString(), server.name, response.conf, response.qr)

      this.messages.sendDone(chat)
      this.bot.deleteMessage(chat.id, messageId)

      tgLogger.log(from, `✅ Client created server [${serverName}]`)

      this.db.updateClientServer(from, server.id, response.public_key)

      if (client?.server) await disableClient(client.server.ip, from.id)
    } catch (error: any) {
      this.error(from, chat, error.message)
    }
  }

  private async subscription(from: User, chat: Chat, messageId?: number) {
    const client = await this.db.getClientWithServer(from)
    if (!client?.server) return this.messages.sendSubscriptionNotFound(from, chat)

    const paidUntil = getSubscriptionExpiredDate(client.expired_at)
    this.messages.sendSubscription(chat, client?.server.label, paidUntil, client.active)
    if (messageId) this.bot.deleteMessage(chat.id, messageId)
  }

  private async files(from: User, chat: Chat, messageId: number) {
    const userId = from.id

    const client = await this.db.getClientWithServer(from)
    if (!client?.server) return this.messages.sendSubscriptionNotFound(from, chat)

    const response = await createClient(client.server.ip, userId)
    if (!response.success || !response.already_exist) return this.error(from, chat, "Not find already created client") //TODO: make endpoint for files

    await this.sendFiles(chat.id, from.username || from.id.toString(), client.server.name, response.conf, response.qr)

    this.messages.sendDone(chat)
    this.bot.deleteMessage(chat.id, messageId)
  }

  private async sendFiles(chatId: number, userName: string, serverName: string, conf: string, qr: string) {
    await this.bot.sendDocument(
      chatId,
      Buffer.from(conf, "base64"),
      {},
      { filename: `fídar-${userName}-${serverName}.conf` }
    )
    await this.bot.sendPhoto(chatId, Buffer.from(qr, "base64"), {}, { filename: `fídar-${userName}-${serverName}` })
  }

  private async promo(from: User, chat: Chat, message: string) {
    this.bot.sendChatAction(chat.id, "typing")
    tgLogger.log(from, `📩 Message(promo) ${message}`)

    const client = await this.db.getClientWithServer(from)
    if (!client) return this.messages.sendSubscriptionNotFound(from, chat)

    const promo = await this.db.getMatchedPromo(message)
    if (!promo) return this.messages.sendPromoNotFound(chat)

    const newExpiredAt = getNewExpiredAt(client.expired_at, promo.months)
    const paidUntil = getSubscriptionExpiredDate(newExpiredAt)

    const success = await this.payment.renewSubscription(client, dbDate(newExpiredAt))
    if (!success) return this.error(from, chat, "Subscription renew error")

    this.messages.sendSuccessfulPromo(chat, paidUntil)
    tgLogger.log(from, `🏷️ Successful promo use [${promo.value}]`)
  }

  private error(from: User, chat: Chat, message: string) {
    tgLogger.error(from, message)
    this.messages.sendServerError(chat)
  }
}

new Telegram().process()
