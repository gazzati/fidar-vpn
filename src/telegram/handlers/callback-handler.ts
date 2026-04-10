import { createClient, disableClient } from "@api/server"
import { getSubscriptionExpiredDate } from "@helpers/date"
import { tgLogger } from "@helpers/logger"
import DbService from "@services/db"
import MessageService from "@services/messages"
import PaymentService from "@services/payment"
import { CallbackAction, parseCallbackData } from "@root/telegram/callback-data"

import { CardTariff, PayMethod, StarsTariff } from "@interfaces/pay"

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
    const parsedData = parseCallbackData(data)
    if (!parsedData) return this.messages.sendStart(from, chat)

    switch (parsedData.action) {
      case CallbackAction.Start:
        return this.start(from, chat, message.message_id)
      case CallbackAction.Trial:
        return this.trial(from, chat, message.message_id)
      case CallbackAction.Locations:
        return this.locations(from, chat, message.message_id)
      case CallbackAction.Files:
        return this.files(from, chat, message.message_id)
      case CallbackAction.Subscription:
        return this.subscription(from, chat, message.message_id)
      case CallbackAction.Support:
        return this.messages.sendHelp(chat)
      case CallbackAction.Manual:
        return this.messages.sendManual(chat)
      case CallbackAction.Pay:
        return this.messages.sendPay(from, chat)
      case CallbackAction.PayCard:
        return this.messages.sendPayTariffs(chat, PayMethod.Card)
      case CallbackAction.payCardBrowser:
        return this.messages.sendPayTariffs(chat, PayMethod.Card, true)
      case CallbackAction.PayStars:
        return this.messages.sendPayTariffs(chat, PayMethod.Stars)
      case CallbackAction.Promo:
        return this.messages.sendPromo(chat)
      case CallbackAction.ChangeServer: {
        const serverName = parsedData.param
        if (!serverName) return this.error(from, chat, "serverName is required")

        return this.changeServer(from, chat, serverName, message.message_id)
      }
      case CallbackAction.Tariff: {
        const tariff = Number(parsedData.param)
        if (Number.isNaN(tariff)) return tgLogger.error(from, "Tariff not found")

        return this.payment.invoice(from, chat, tariff)
      }
      case CallbackAction.TariffCard: {
        const tariff = Number(parsedData.param)
        if (Number.isNaN(tariff) || !Object.values(CardTariff).includes(tariff))
          return tgLogger.error(from, "Tariff not found")

        return this.payment.invoice(from, chat, tariff, PayMethod.Card)
      }
      case CallbackAction.TariffCardLink: {
        const tariff = Number(parsedData.param)
        if (Number.isNaN(tariff) || !Object.values(CardTariff).includes(tariff))
          return tgLogger.error(from, "Tariff not found")

        return this.payment.createPaymentLink(from, chat, tariff)
      }
      case CallbackAction.TariffStars: {
        const tariff = Number(parsedData.param)
        if (Number.isNaN(tariff) || !Object.values(StarsTariff).includes(tariff))
          return tgLogger.error(from, "Tariff not found")

        return this.payment.invoice(from, chat, tariff, PayMethod.Stars)
      }
      case CallbackAction.CheckPayment: {
        const paymentId = parsedData.param
        if (!paymentId) return tgLogger.error(from, "Payment id not found")

        return this.payment.checkPayment(from, chat, paymentId)
      }
    }
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

      const updated = await this.db.updateClientServer(from, server.id, response.public_key)
      if (!updated) return this.error(from, chat, "Client update error")

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
    await this.bot.sendDocument(chatId, Buffer.from(conf, "base64"), {}, { filename: `fidar${serverName}.conf` })
    await this.bot.sendPhoto(chatId, Buffer.from(qr, "base64"), {}, { filename: `fidar-${userName}-${serverName}` })
  }

  private error(from: User, chat: Chat, message: string) {
    tgLogger.error(from, message)
    this.messages.sendServerError(chat)
  }
}

export default CallbackHandler
