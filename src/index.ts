import "./aliases"
import TelegramBot from "node-telegram-bot-api"

import config from "./config"
import DbService from "@services/db"
import MessageService from "@services/messages"
import PaymentService from "@services/payment"
import CallbackHandler from "@root/telegram/handlers/callback-handler"
import CommandHandler, { COMMANDS } from "@root/telegram/handlers/command-handler"
import PromoHandler from "@root/telegram/handlers/promo-handler"
import SystemCommandHandler from "@root/telegram/handlers/system-command-handler"

class Telegram {
  private bot = new TelegramBot(config.telegramToken, { polling: true })
  private systemBot = new TelegramBot(config.systemTelegramToken, { polling: true })

  private waitingPromoIds: Array<number> = []

  private db = new DbService()
  private messages = new MessageService(this.bot, this.db, this.waitingPromoIds)
  private payment = new PaymentService(this.bot, this.db, this.messages)

  private callbacks = new CallbackHandler(this.bot, this.db, this.messages, this.payment)
  private commands = new CommandHandler(this.messages, this.callbacks)
  private systemCommands = new SystemCommandHandler(this.systemBot)
  private promo = new PromoHandler(this.bot, this.db, this.messages, this.payment, this.waitingPromoIds)

  private async isBlocked(userId?: number): Promise<boolean> {
    if (!userId) return false

    return await this.db.isBlacklisted(userId)
  }

  public process() {
    this.bot.on("message", async (msg) => {
      const { from, chat, text } = msg
      if (!from || !text) return
      if (await this.isBlocked(from.id)) return

      if (COMMANDS.includes(text)) return this.commands.handle(from, chat, text)

      this.promo.handle(from, chat, text)
    })

    this.bot.on("callback_query", async (query) => {
      if (await this.isBlocked(query.from?.id)) return

      return this.callbacks.handle(query)
    })

    this.bot.on("pre_checkout_query", async (query) => {
      if (await this.isBlocked(query.from?.id)) {
        return this.bot.answerPreCheckoutQuery(query.id, false, {
          error_message: config.phrases.FAILED_PAYMENT_MESSAGE
        })
      }

      return this.payment.preCheckoutQuery(query)
    })

    this.bot.on("successful_payment", async (message) => {
      if (await this.isBlocked(message.from?.id)) return

      return this.payment.successfulPayment(message)
    })

    this.systemCommands.process()
  }
}

new Telegram().process()
