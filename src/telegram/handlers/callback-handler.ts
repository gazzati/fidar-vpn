import { createClient, disableClient } from "@api/server"
import { getSubscriptionExpiredDate } from "@helpers/date"
import { tgLogger } from "@helpers/logger"
import DbService from "@services/db"
import MessageService from "@services/messages"
import PaymentService from "@services/payment"
import config from "@root/config"

import { PayTariff } from "@interfaces/pay"

import TelegramBot, { type User, type Chat, type CallbackQuery } from "node-telegram-bot-api"

class CallbackHandler {
  constructor(
    private bot: TelegramBot,
    private db: DbService,
    private messages: MessageService,
    private payment: PaymentService
  ) {}

  public async handle(query: CallbackQuery) {
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

      return this.changeServer(from, chat, serverName, message.message_id)
    }

    if (data.includes(config.callbackData.tariff)) {
      const [, tariff] = data.split(":") as [string, PayTariff]
      if (!tariff) return tgLogger.error(from, "Tariff not found")

      return this.payment.invoice(from, chat, Number(tariff))
    }

    return this.messages.sendStart(from, chat)
  }

  public async subscription(from: User, chat: Chat, messageId?: number) {
    const client = await this.db.getClientWithServer(from)
    if (!client?.server) return this.messages.sendSubscriptionNotFound(from, chat)

    const paidUntil = getSubscriptionExpiredDate(client.expired_at)
    this.messages.sendSubscription(chat, client.server.label, paidUntil, client.active)
    if (messageId) this.bot.deleteMessage(chat.id, messageId)
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
        tgLogger.log(from, "💵 Not paid")
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

      if (client.server) await disableClient(client.server.ip, from.id)
    } catch (error: any) {
      this.error(from, chat, error.message)
    }
  }

  private async files(from: User, chat: Chat, messageId: number) {
    const client = await this.db.getClientWithServer(from)
    if (!client?.server) return this.messages.sendSubscriptionNotFound(from, chat)

    const response = await createClient(client.server.ip, from.id)
    if (!response.success || !response.already_exist) return this.error(from, chat, "Not find already created client")

    await this.sendFiles(chat.id, from.username || from.id.toString(), client.server.name, response.conf, response.qr)

    this.messages.sendDone(chat)
    this.bot.deleteMessage(chat.id, messageId)
  }

  private async sendFiles(chatId: number, userName: string, serverName: string, conf: string, qr: string) {
    await this.bot.sendDocument(
      chatId,
      Buffer.from(conf, "base64"),
      {},
      { filename: `fidar${serverName}.conf` }
    )
    await this.bot.sendPhoto(chatId, Buffer.from(qr, "base64"), {}, { filename: `fidar-${userName}-${serverName}` })
  }

  private error(from: User, chat: Chat, message: string) {
    tgLogger.error(from, message)
    this.messages.sendServerError(chat)
  }
}

export default CallbackHandler
