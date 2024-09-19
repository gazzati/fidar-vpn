import { enableClient } from "@api/server"
import TelegramBot, { Chat, User, PreCheckoutQuery, Message } from "node-telegram-bot-api"

import config from "@root/config"

import { Client } from "@database/entities/Client"
import { getSubscriptionExpiredDate, getNewExpiredAt, dbDate } from "@helpers/date"
import { tgLogger, error } from "@helpers/logger"
import { getTariffName, getTariffMonths } from "@helpers/tariff"

import { PayTariff } from "@interfaces/pay"

import DbService from "./db"
import MessageService from "./messages"

class PaymentService {
  constructor(private bot: TelegramBot, private db: DbService, private messages: MessageService) {}

  public async preCheckoutQuery(query: PreCheckoutQuery) {
    const { from } = query

    const client = await this.db.getClient(from)
    if (!client) {
      tgLogger.error(from, "Client not found")
      return await this.bot.answerPreCheckoutQuery(query.id, false, {
        error_message: config.phrases.FAILED_PAYMENT_MESSAGE
      })
    }

    return await this.bot.answerPreCheckoutQuery(query.id, true)
  }

  public async successfulPayment(message: Message) {
    const { from, chat } = message

    if (!from) {
      error("[from] is required", chat)
      return this.messages.sendServerError(chat)
    }

    const tariff = message.successful_payment?.total_amount
    if (!tariff) {
      tgLogger.error(from, "[tariff] is required")
      return this.messages.sendServerError(chat)
    }

    const client = await this.db.getClientWithServer(from)
    if (!client?.server) {
      error("Client not found", chat)
      return this.messages.sendServerError(chat)
    }

    const months = getTariffMonths(tariff / 100)
    const newExpiredAt = getNewExpiredAt(client.expired_at, months)
    const paidUntil = getSubscriptionExpiredDate(newExpiredAt)

    const success = await this.renewSubscription(client, dbDate(newExpiredAt))
    if (!success) {
      error("Subscription renew error", chat)
      return this.messages.sendServerError(chat)
    }

    this.messages.sendSuccessfulPayment(chat, paidUntil)
    tgLogger.log(from, `🔥 Successful payment amount: [${tariff / 100}]`)
  }

  public async invoice(from: User, chat: Chat, tariff: PayTariff) {
    const client = await this.db.getClient(from)
    if (!client) {
      error("Client not found", chat)
      return this.messages.sendServerError(chat)
    }

    const tariffName = getTariffName(tariff)
    const months = getTariffMonths(tariff)

    const newExpiredAt = getNewExpiredAt(client.expired_at, months)
    const paidUntil = getSubscriptionExpiredDate(newExpiredAt)

    await this.bot.sendInvoice(
      chat.id,
      "Оплата подписки\n\n",
      `\n\nПродление на ${tariffName}. Ваша подписка будет продлена до ${paidUntil}`,
      tariffName,
      config.providerToken,
      config.currency,
      [{ label: tariffName, amount: tariff * 100 }]
    )
  }

  public async renewSubscription(client: Client, newExpiredAt: string): Promise<boolean> {
    try {
      if (client.public_key && !client.active) {
        const response = await enableClient(client.server.ip, client.user_id, client.public_key)
        if (!response) return false
      }

      this.db.updateClientExpiredAt(client.user_id, newExpiredAt)

      return true
    } catch (e) {
      error("Subscription renew error", e)
      return false
    }
  }
}

export default PaymentService
