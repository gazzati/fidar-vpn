import { enableClient } from "@api/server"
import axios from "axios"
import TelegramBot, { Chat, User, PreCheckoutQuery, Message } from "node-telegram-bot-api"
import { randomUUID } from "crypto"

import config from "@root/config"

import { Client } from "@database/entities/Client"
import { getSubscriptionExpiredDate, getNewExpiredAt, dbDate } from "@helpers/date"
import { tgLogger, error } from "@helpers/logger"
import {
  getTariffName,
  getTariffMonths,
  getInvoiceAmount,
  getPaidAmount,
  getPayMethodByCurrency
} from "@helpers/tariff"

import { PayMethod, PaymentCurrency } from "@interfaces/pay"

import DbService from "./db"
import MessageService from "./messages"

class PaymentService {
  private readonly yookassaApiUrl = "https://api.yookassa.ru/v3/payments"

  constructor(
    private bot: TelegramBot,
    private db: DbService,
    private messages: MessageService
  ) {}

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

    const successfulPayment = message.successful_payment
    const tariff = successfulPayment?.total_amount
    if (!successfulPayment || !tariff) {
      tgLogger.error(from, "[tariff] is required")
      return this.messages.sendServerError(chat)
    }
    const paidAmount = getPaidAmount(tariff, successfulPayment.currency)
    const method = getPayMethodByCurrency(successfulPayment.currency)
    await this.finalizePayment({
      from,
      chat,
      amount: paidAmount,
      currency: successfulPayment.currency,
      method,
      telegramPaymentChargeId: successfulPayment.telegram_payment_charge_id,
      invoicePayload: successfulPayment.invoice_payload,
      providerPaymentChargeId: successfulPayment.provider_payment_charge_id
    })
    tgLogger.log(from, `🔥 Successful payment amount: [${paidAmount} ${successfulPayment.currency}]`)
  }

  public async invoice(from: User, chat: Chat, tariff: number, method: PayMethod = PayMethod.Card) {
    const client = await this.db.getClient(from)
    if (!client) {
      error("Client not found", chat)
      return this.messages.sendServerError(chat)
    }

    const tariffName = getTariffName(method, tariff)
    const months = getTariffMonths(method, tariff)
    if (!tariffName || !months) {
      error(`Tariff not found for method [${method}] and price [${tariff}]`, chat)
      return this.messages.sendServerError(chat)
    }

    const newExpiredAt = getNewExpiredAt(client.expired_at, months)
    const paidUntil = getSubscriptionExpiredDate(newExpiredAt)
    const starsPayment = method === PayMethod.Stars
    const currency = starsPayment ? PaymentCurrency.Stars : PaymentCurrency.Rub
    if (!starsPayment && !config.providerToken) {
      error("Provider token is required for non-stars payments", chat)
      return this.messages.sendServerError(chat)
    }

    await this.bot.sendInvoice(
      chat.id,
      "Оплата подписки\n\n",
      `\n\nПродление на ${tariffName}. Ваша подписка будет продлена до ${paidUntil}`,
      tariffName,
      starsPayment ? "" : config.providerToken,
      currency,
      [{ label: tariffName, amount: getInvoiceAmount(tariff, currency) }]
    )
  }

  public async createPaymentLink(from: User, chat: Chat, tariff: number) {
    const client = await this.db.getClient(from)
    if (!client) {
      error("Client not found", chat)
      return this.messages.sendServerError(chat)
    }

    const tariffName = getTariffName(PayMethod.Card, tariff)
    const months = getTariffMonths(PayMethod.Card, tariff)
    if (!tariffName || !months) {
      error(`Tariff not found for external payment [${tariff}]`, chat)
      return this.messages.sendServerError(chat)
    }

    if (!config.yookassaShopId || !config.yookassaSecretKey || !config.yookassaReturnUrl) {
      error("YooKassa credentials are required for external payments", chat)
      return this.messages.sendServerError(chat)
    }

    const newExpiredAt = getNewExpiredAt(client.expired_at, months)
    const paidUntil = getSubscriptionExpiredDate(newExpiredAt)

    try {
      const response = await axios.post<YooKassaPaymentResponse>(
        this.yookassaApiUrl,
        {
          amount: {
            value: tariff.toFixed(2),
            currency: PaymentCurrency.Rub
          },
          capture: true,
          confirmation: {
            type: "redirect",
            return_url: config.yookassaReturnUrl
          },
          description: `Оплата подписки Fidar на ${tariffName}`,
          metadata: {
            user_id: from.id.toString(),
            tariff: tariff.toString(),
            months: months.toString(),
            chat_id: chat.id.toString()
          }
        },
        {
          headers: this.getYooKassaHeaders(randomUUID()),
          timeout: 10_000
        }
      )

      const payment = response.data
      const paymentUrl = payment.confirmation?.confirmation_url
      const paymentId = payment.id
      if (!paymentId || !paymentUrl) {
        error("YooKassa confirmation url not found", payment)
        return this.messages.sendServerError(chat)
      }

      const confirmedPaymentUrl: string = paymentUrl
      return this.messages.sendExternalPaymentLink(chat, confirmedPaymentUrl, paidUntil)
    } catch (e: any) {
      error("YooKassa create payment error", e.response?.data || e.message)
      return this.messages.sendServerError(chat)
    }
  }

  public async checkPayment(from: User, chat: Chat, paymentId: string) {
    if (!config.yookassaShopId || !config.yookassaSecretKey) {
      error("YooKassa credentials are required for payment status checks", chat)
      return this.messages.sendServerError(chat)
    }

    try {
      const response = await axios.get<YooKassaPaymentResponse>(`${this.yookassaApiUrl}/${paymentId}`, {
        headers: this.getYooKassaHeaders(),
        timeout: 10_000
      })

      const payment = response.data
      if (payment.status !== "succeeded") {
        return this.messages.sendPaymentPending(chat)
      }

      const tariff = Number(payment.metadata?.tariff)
      if (Number.isNaN(tariff)) {
        error("YooKassa payment metadata tariff is invalid", payment)
        return this.messages.sendServerError(chat)
      }

      return await this.finalizePayment({
        from,
        chat,
        amount: tariff,
        currency: payment.amount.currency,
        method: PayMethod.Card,
        telegramPaymentChargeId: payment.id,
        providerPaymentChargeId: payment.payment_method?.id,
        invoicePayload: payment.description
      })
    } catch (e: any) {
      error("YooKassa payment status error", e.response?.data || e.message)
      return this.messages.sendServerError(chat)
    }
  }

  public async processYooKassaWebhook(notification: YooKassaWebhookNotification): Promise<void> {
    if (notification.event !== "payment.succeeded") return

    const payment = notification.object
    const paymentId = payment.id
    if (!paymentId) {
      throw new Error("YooKassa webhook payment id is required")
    }

    const response = await axios.get<YooKassaPaymentResponse>(`${this.yookassaApiUrl}/${paymentId}`, {
      headers: this.getYooKassaHeaders(),
      timeout: 10_000
    })

    const verifiedPayment = response.data
    if (verifiedPayment.status !== "succeeded") return

    const userId = Number(verifiedPayment.metadata?.user_id)
    const tariff = Number(verifiedPayment.metadata?.tariff)
    if (Number.isNaN(userId) || Number.isNaN(tariff)) {
      throw new Error("YooKassa webhook metadata is invalid")
    }

    await this.finalizeExternalPayment({
      userId,
      amount: tariff,
      currency: verifiedPayment.amount.currency,
      telegramPaymentChargeId: verifiedPayment.id,
      providerPaymentChargeId: verifiedPayment.payment_method?.id,
      invoicePayload: verifiedPayment.description
    })
  }

  public async renewSubscription(client: Client, newExpiredAt: string): Promise<boolean> {
    try {
      if (client.public_key && !client.active) {
        const response = await enableClient(client.server.ip, client.user_id, client.public_key)
        if (!response) return false
      }

      const updated = await this.db.updateClientExpiredAt(client.user_id, newExpiredAt)
      if (!updated) return false

      return true
    } catch (e) {
      error("Subscription renew error", e)
      return false
    }
  }

  private async finalizePayment(params: FinalizePaymentParams) {
    const { from, chat, amount, currency, method, telegramPaymentChargeId, invoicePayload, providerPaymentChargeId } =
      params

    const client = await this.db.getClientWithServer(from)
    if (!client?.server) {
      error("Client not found", chat)
      return this.messages.sendServerError(chat)
    }

    const exists = await this.db.hasPayment(telegramPaymentChargeId)
    if (exists) {
      const paidUntil = getSubscriptionExpiredDate(client.expired_at)
      return this.messages.sendPaymentAlreadyConfirmed(chat, paidUntil)
    }

    const months = getTariffMonths(method, amount)
    if (months === undefined) {
      error(`Error month calculating for tariff: ${amount}`, chat)
      return this.messages.sendServerError(chat)
    }

    const newExpiredAt = getNewExpiredAt(client.expired_at, months)
    const paidUntil = getSubscriptionExpiredDate(newExpiredAt)

    const paymentSaved = await this.db.savePayment({
      clientId: client.id,
      amount,
      currency,
      months,
      paidUntil: dbDate(newExpiredAt),
      invoicePayload,
      telegramPaymentChargeId,
      providerPaymentChargeId
    })
    if (!paymentSaved) {
      error("Payment saving error", chat)
      return this.messages.sendServerError(chat)
    }

    const success = await this.renewSubscription(client, dbDate(newExpiredAt))
    if (!success) {
      error("Subscription renew error", chat)
      return this.messages.sendServerError(chat)
    }

    return this.messages.sendSuccessfulPayment(chat, paidUntil)
  }

  private async finalizeExternalPayment(params: FinalizeExternalPaymentParams) {
    const { userId, amount, currency, telegramPaymentChargeId, invoicePayload, providerPaymentChargeId } = params

    const client = await this.db.getClientWithServerByUserId(userId)
    if (!client?.server) {
      throw new Error(`Client not found for user [${userId}]`)
    }

    const exists = await this.db.hasPayment(telegramPaymentChargeId)
    if (exists) return

    const months = getTariffMonths(PayMethod.Card, amount)
    if (months === undefined) {
      throw new Error(`Error month calculating for tariff: ${amount}`)
    }

    const newExpiredAt = getNewExpiredAt(client.expired_at, months)
    const paidUntil = getSubscriptionExpiredDate(newExpiredAt)

    const paymentSaved = await this.db.savePayment({
      clientId: client.id,
      amount,
      currency,
      months,
      paidUntil: dbDate(newExpiredAt),
      invoicePayload,
      telegramPaymentChargeId,
      providerPaymentChargeId
    })
    if (!paymentSaved) {
      throw new Error("Payment saving error")
    }

    const success = await this.renewSubscription(client, dbDate(newExpiredAt))
    if (!success) {
      throw new Error("Subscription renew error")
    }

    const from = {
      id: client.user_id,
      is_bot: false,
      first_name: client.first_name || client.username || "unknown",
      ...(client.last_name && { last_name: client.last_name }),
      ...(client.username && { username: client.username })
    } as User

    tgLogger.log(from, `🔥 Successful payment amount: [${amount} ${currency}]`)

    const chat = { id: Number(client.chat_id) } as Chat
    this.messages.sendSuccessfulPayment(chat, paidUntil)
  }

  private getYooKassaHeaders(idempotenceKey?: string): Record<string, string> {
    const headers: Record<string, string> = {
      Authorization: `Basic ${Buffer.from(`${config.yookassaShopId}:${config.yookassaSecretKey}`).toString("base64")}`
    }

    if (idempotenceKey) {
      headers["Content-Type"] = "application/json"
      headers["Idempotence-Key"] = idempotenceKey
    }

    return headers
  }
}

export default PaymentService

interface FinalizePaymentParams {
  from: User
  chat: Chat
  amount: number
  currency: string
  method: PayMethod
  telegramPaymentChargeId: string
  invoicePayload?: string
  providerPaymentChargeId?: string
}

interface FinalizeExternalPaymentParams {
  userId: number
  amount: number
  currency: string
  telegramPaymentChargeId: string
  invoicePayload?: string
  providerPaymentChargeId?: string
}

interface YooKassaPaymentResponse {
  id: string
  status: string
  description?: string
  amount: {
    value: string
    currency: string
  }
  confirmation?: {
    type: string
    confirmation_url?: string | null
  }
  payment_method?: {
    id?: string
    type?: string
  }
  metadata?: Record<string, string>
}

interface YooKassaWebhookNotification {
  type: "notification"
  event: string
  object: YooKassaPaymentResponse
}
