import { dbDate, getNewExpiredAt, getSubscriptionExpiredDate } from "@helpers/date"
import { tgLogger } from "@helpers/logger"
import DbService from "@services/db"
import MessageService from "@services/messages"
import PaymentService from "@services/payment"

import TelegramBot, { type User, type Chat } from "node-telegram-bot-api"

class PromoHandler {
  constructor(
    private bot: TelegramBot,
    private db: DbService,
    private messages: MessageService,
    private payment: PaymentService,
    private waitingPromoIds: Array<number>
  ) {}

  public async handle(from: User, chat: Chat, message: string) {
    if (!this.waitingPromoIds.includes(chat.id)) return

    this.bot.sendChatAction(chat.id, "typing")
    tgLogger.log(from, `📩 Message(promo) ${message}`)

    const client = await this.db.getClientWithServer(from)
    if (!client) return this.messages.sendSubscriptionNotFound(from, chat)

    const promo = await this.db.getMatchedPromo(message.toLowerCase())
    if (!promo) return this.messages.sendPromoNotFound(chat)

    const newExpiredAt = getNewExpiredAt(client.expired_at, promo.months)
    const paidUntil = getSubscriptionExpiredDate(newExpiredAt)

    const success = await this.payment.renewSubscription(client, dbDate(newExpiredAt))
    if (!success) return this.error(from, chat, "Subscription renew error")

    const index = this.waitingPromoIds.indexOf(chat.id)
    if (index >= 0) this.waitingPromoIds.splice(index, 1)

    this.messages.sendSuccessfulPromo(chat, paidUntil)
    tgLogger.log(from, `🏷️ Successful promo use [${promo.value}]`)
  }

  private error(from: User, chat: Chat, message: string) {
    tgLogger.error(from, message)
    this.messages.sendServerError(chat)
  }
}

export default PromoHandler
