import "./aliases"
import { createClient, revokeClient } from "@api/server"
import TelegramBot, { type User, Chat, CallbackQuery } from "node-telegram-bot-api"

import { getNewExpiredAt, dbDate } from "@root/helpers/date"

import { getSubscriptionExpiredDate, getTrialExpiredAt } from "@helpers/date"
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

      this.message(from, chat, text)
    })

    this.bot.on("callback_query", query => this.callbackQuery(query))
    this.bot.on("pre_checkout_query", query => this.payment.preCheckoutQuery(query))
    this.bot.on("successful_payment", message => this.payment.successfulPayment(message))
  }

  private async message(from: User, chat: Chat, message: string) {
    this.bot.sendChatAction(chat.id, "typing")
    tgLogger.log(from, `📩 Message(promo) ${message}`)

    await this.promo(from, chat, message)
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

    if (data === config.callbackData.location) {
      const client = await this.db.getClientWithServer(from)

      const servers = await this.db.getServersForClient(client)
      if (!servers) return tgLogger.error(from, "Servers not found")

      this.messages.sendLocation(chat, servers, !!client)
      return this.bot.deleteMessage(message.chat.id, message.message_id)
    }

    if (data.includes(config.callbackData.create)) {
      const [, serverName] = data.split(":")
      if (!serverName) return tgLogger.error(from, "Servers not found")

      return this.create(from, chat, serverName, message.message_id)
    }

    if (data.includes(config.callbackData.tariff)) {
      const [, tariff] = data.split(":") as [any, PayTariff]
      if (!tariff) return tgLogger.error(from, "Tariff not found")

      const client = await this.db.getClient(from)
      if (!client) return this.error(from, chat, "Client not found")

      await this.payment.invoice(chat, client, Number(tariff))
      return this.bot.deleteMessage(message.chat.id, message.message_id)
    }

    if (data === config.callbackData.start) {
      await this.messages.sendStart(from, chat)
      return this.bot.deleteMessage(message.chat.id, message.message_id)
    }

    if (data === config.callbackData.subscription) {
      this.subscription(from, chat)
      return this.bot.deleteMessage(message.chat.id, message.message_id)
    }

    if (data === config.callbackData.manual) return this.messages.sendManual(chat)
    if (data === config.callbackData.pay) return this.messages.sendPay(from, chat)
    if (data === config.callbackData.promo) return this.messages.sendPromo(chat)
    if (data === config.callbackData.files) return this.files(from, chat)
    if (data === config.callbackData.support) return this.messages.sendHelp(chat)
  }

  private async create(from: User, chat: Chat, serverName: string, messageId: number) {
    try {
      const userId = from.id

      const client = await this.db.getClientWithServer(from)

      if (client) {
        const expired = new Date() > new Date(client.expired_at)
        if (expired) {
          tgLogger.log(from, `💵 Not paid`)
          this.messages.sendNeedPay(chat)
          return
        }
      }

      const server = await this.db.getServer(serverName)
      if (!server?.ip) return this.error(from, chat, `Server [${serverName}] not found`)

      const response = await createClient(server.ip, userId)
      if (!response.success) throw Error("Client creating error")

      if (response.already_exist) {
        this.messages.sendAlreadyExistError(chat)
        await new Promise(resolve => setTimeout(resolve, 1000))
      }

      this.bot.deleteMessage(chat.id, messageId)
      await this.sendFiles(chat.id, from.username || from.id.toString(), response.conf, response.qr)

      this.messages.sendDone(chat)

      tgLogger.log(from, `✅ Client created server [${serverName}]`)

      if (response.already_exist) return
      if (!response.public_key) return this.error(from, chat, "[public_key] not found")

      if (client?.server) {
        const response = await revokeClient(client.server.ip, userId)
        if (!response?.success)
          return this.error(from, chat, `Error with client [${client.id}] deleting from [${serverName}]`)
      }

      if (!client) return this.db.saveClient(from, chat, server.id, response.public_key, getTrialExpiredAt())
      this.db.updateClientServer(from, server.id, response.public_key)
    } catch (error: any) {
      this.error(from, chat, error)
    }
  }

  private async subscription(from: User, chat: Chat) {
    const client = await this.db.getClientWithServer(from)
    if (!client?.server) return this.messages.sendNotFound(from, chat)

    const paidUntil = getSubscriptionExpiredDate(client.expired_at)
    this.messages.sendSubscription(chat, client?.server.label, paidUntil, !!client.trial_used)
  }

  private async promo(from: User, chat: Chat, message: string) {
    const client = await this.db.getClient(from)
    if (!client) return this.messages.sendNotFound(from, chat)

    const promo = await this.db.getMatchedPromo(message)
    if (!promo) return this.messages.sendPromoNotFound(chat)

    const newExpiredAt = getNewExpiredAt(client.expired_at, promo.months)
    const paidUntil = getSubscriptionExpiredDate(newExpiredAt)

    this.db.updateClientExpiredAt(from, dbDate(newExpiredAt))

    this.messages.sendSuccessfulPromo(chat, paidUntil)
    tgLogger.log(from, `🏷️ Successful promo use [${promo.value}]`)
  }

  private async files(from: User, chat: Chat) {
    const userId = from.id

    const client = await this.db.getClientWithServer(from)
    if (!client?.server) return this.messages.sendNotFound(from, chat)

    const response = await createClient(client.server.ip, userId)
    if (!response.success || !response.already_exist) throw Error("Not find already created client")

    await this.sendFiles(chat.id, from.username || from.id.toString(), response.conf, response.qr)

    this.messages.sendDone(chat)
  }

  private async sendFiles(chatId: number, userName: string, conf: string, qr: string) {
    await this.bot.sendDocument(chatId, Buffer.from(conf, "base64"), {}, { filename: `fídar-vpn-${userName}.conf` })
    await this.bot.sendPhoto(chatId, Buffer.from(qr, "base64"), {}, { filename: `fídar-vpn-${userName}` })

    await new Promise(resolve => setTimeout(resolve, 1000))
  }

  private error(from: User, chat: Chat, message: string) {
    tgLogger.error(from, message)
    this.messages.sendServerError(chat)
  }
}

new Telegram().process()
