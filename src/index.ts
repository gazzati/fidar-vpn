import "./aliases"
import TelegramBot from "node-telegram-bot-api"
import type { Options } from "request"

import config from "./config"
import DbService from "@services/db"
import MessageService from "@services/messages"
import PaymentService from "@services/payment"
import CallbackHandler from "@root/telegram/handlers/callback-handler"
import CommandHandler, { COMMANDS } from "@root/telegram/handlers/command-handler"
import PromoHandler from "@root/telegram/handlers/promo-handler"
import SystemCommandHandler from "@root/telegram/handlers/system-command-handler"

class Telegram {
  private bot = new TelegramBot(config.telegramToken, this.buildBotOptions())
  private systemBot = config.systemTelegramToken
    ? new TelegramBot(config.systemTelegramToken, this.buildBotOptions())
    : null

  private waitingPromoIds: Array<number> = []

  private db = new DbService()
  private messages = new MessageService(this.bot, this.db, this.waitingPromoIds)
  private payment = new PaymentService(this.bot, this.db, this.messages)

  private callbacks = new CallbackHandler(this.bot, this.db, this.messages, this.payment)
  private commands = new CommandHandler(this.messages, this.callbacks)
  private systemCommands = this.systemBot ? new SystemCommandHandler(this.systemBot) : null
  private promo = new PromoHandler(this.bot, this.db, this.messages, this.payment, this.waitingPromoIds)

  private async isBlocked(userId?: number): Promise<boolean> {
    if (!userId) return false

    return await this.db.isBlacklisted(userId)
  }

  public process() {
    this.attachBotErrorHandlers(this.bot, "main")

    if (this.systemBot) {
      this.attachBotErrorHandlers(this.systemBot, "system")
    }

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

    this.systemCommands?.process()
  }

  private attachBotErrorHandlers(bot: TelegramBot, name: string) {
    bot.on("polling_error", (error) => {
      console.error(`[telegram:${name}] polling_error`, this.formatTelegramError(error))
    })

    bot.on("error", (error) => {
      console.error(`[telegram:${name}] error`, this.formatTelegramError(error))
    })
  }

  private buildBotOptions(): TelegramBot.ConstructorOptions {
    const request = config.telegramIpFamily ? ({ family: config.telegramIpFamily } as Options) : undefined

    return {
      polling: true,
      request
    }
  }

  private formatTelegramError(error: unknown): unknown {
    if (this.isAggregateError(error)) {
      return {
        name: error.name,
        message: error.message,
        code: this.readProp(error, "code"),
        cause: this.formatTelegramError(this.readProp(error, "cause")),
        errors: error.errors.map((item: unknown) => this.formatTelegramError(item))
      }
    }

    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
        code: this.readProp(error, "code"),
        errno: this.readProp(error, "errno"),
        syscall: this.readProp(error, "syscall"),
        address: this.readProp(error, "address"),
        port: this.readProp(error, "port"),
        response: this.formatTelegramResponse(this.readProp(error, "response")),
        cause: this.formatTelegramError(this.readProp(error, "cause")),
        stack: error.stack
      }
    }

    return error
  }

  private formatTelegramResponse(response: unknown): unknown {
    if (!response || typeof response !== "object") return response

    return {
      statusCode: this.readProp(response, "statusCode"),
      body: this.readProp(response, "body")
    }
  }

  private readProp(value: unknown, key: string): unknown {
    if (!value || typeof value !== "object") return undefined

    return (value as Record<string, unknown>)[key]
  }

  private isAggregateError(error: unknown): error is Error & { errors: Array<unknown> } {
    return (
      error instanceof Error &&
      "errors" in error &&
      Array.isArray((error as { errors?: Array<unknown> }).errors)
    )
  }
}

new Telegram().process()
