import "./aliases"
import { createClient, revokeClient } from "@api/index"
import TelegramBot, { type User, Chat, CallbackQuery, InlineKeyboardButton, PreCheckoutQuery, Message } from "node-telegram-bot-api"
import { Not } from "typeorm"

import { entities } from "@database/data-source"
import { type Client } from "@database/entities/Client"
import { Server } from "@database/entities/Server"
import { getSubscriptionExpiredDate } from "@helpers/date"
import { tgLogger } from "@helpers/logger"
import {getTariffName, getTariffMonths} from '@helpers/tariff';

import {PayTariff} from '@interfaces/pay';
import { TelegramCommand } from "@interfaces/telegram"

import config from "./config"

export const COMMANDS: Array<string> = [TelegramCommand.Start, TelegramCommand.Subscription, TelegramCommand.Pay, TelegramCommand.Help]

class Telegram {
  private bot = new TelegramBot(config.telegramToken, { polling: true })

  public process() {
    this.bot.on("message", msg => {
      const { from, chat, text } = msg
      if (!from || !text) return

      if (COMMANDS.includes(text)) return this.commands(from, chat, text)

      this.message(from, chat, text)
    })

    this.bot.on("callback_query", query => this.callbackQuery(query))
    this.bot.on("pre_checkout_query", query => this.preCheckoutQuery(query))
    this.bot.on("successful_payment", message => this.successfulPayment(message))
  }

  private message(from: User, chat: Chat, message: string) {
    this.bot.sendChatAction(chat.id, "typing")
    tgLogger.log(from, `📩 Message ${message}`)
  }

  private commands(from: User, chat: Chat, action: string) {
    tgLogger.log(from, `📋 Command ${action}`)

    switch (action) {
      case TelegramCommand.Start:
        return this.sendStartMessage(from, chat)
      case TelegramCommand.Subscription:
        return this.subscription(from, chat)
      case TelegramCommand.Pay:
        return this.sendPayMessage(from, chat)
      case TelegramCommand.Help:
        return this.sendHelpMessage(chat)
    }
  }

  private async callbackQuery(query: CallbackQuery) {
    const {message, data, from} = query
    if(!message || !data || !from) return

    tgLogger.log(from, `🤙 Callback query ${data}`)

    const {chat} = message

    if (data === config.callbackData.location) {
      const client = await this.getClientWithServer(from)

      const servers = await entities.Server.find({ where: { active: true, ...(client && { id: Not(client.server.id)})  } })
      if(!servers) return tgLogger.error(from, "Servers not found")

      this.sendLocationMessage(chat, servers, !!client)
      return this.bot.deleteMessage(message.chat.id, message.message_id)
    }

    if (data.includes(config.callbackData.create)) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const [_, serverName] = data.split(":")
      if(!serverName) return tgLogger.error(from, "Servers not found")

      return this.create(from, chat, serverName, message.message_id)
    }

    if (data.includes(config.callbackData.tariff)) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const [_, tariff ] = data.split(":") as [any, PayTariff]
      if(!tariff) return tgLogger.error(from, "Tariff not found")

      await this.invoice(from, chat, Number(tariff))
      return this.bot.deleteMessage(message.chat.id, message.message_id)
    }

    if (data === config.callbackData.start) {
      await this.sendStartMessage(from, chat)
      return this.bot.deleteMessage(message.chat.id, message.message_id)
    }

    if (data === config.callbackData.manual) return this.sendManualMessage(chat)
    if (data === config.callbackData.pay) return this.sendPayMessage(from, chat)
    if (data === config.callbackData.subscription) return this.subscription(from, chat)
    if (data === config.callbackData.files) return this.files(from, chat)
    if (data === config.callbackData.support) return this.sendHelpMessage(chat)
  }

  private async preCheckoutQuery(query: PreCheckoutQuery) {
    const {from} = query

    const client = await this.getClient(from)
    if(!client) {
      tgLogger.log(from, `❌ Client ${from.id} not found`)
      return  await this.bot.answerPreCheckoutQuery(query.id, false, {error_message: config.phrases.FAILED_PAYMENT_MESSAGE})
    }

    return await this.bot.answerPreCheckoutQuery(query.id, true)
  }

  private successfulPayment(message: Message) {
    this.sendSuccessfulPaymentMessage(message.chat)
    if(message.from) tgLogger.log(message.from, `🔥 Successful payment [${message.successful_payment?.invoice_payload}]`)
  }

  private async create(from: User, chat: Chat, serverName: string, messageId: number) {
    try {
      const userId = from.id

      const client = await this.getClientWithServer(from)
      if(client) {
        const expired = new Date() > new Date(client.expired_at)
        if(expired) {
          tgLogger.log(from, `💵 Not paid`)
          this.sendNeedPayMessage(chat)
          return
        }
      }

      const server = await entities.Server.findOne({ where: { name: serverName } })
      if (!server?.ip) {
        tgLogger.log(from, `❌ Server [${serverName}] not found`)
        this.sendMessage(chat, config.phrases.SERVER_ERROR_MESSAGE)
        return
      }

      const response = await createClient(server.ip, userId)
      if (!response.success) throw Error("Client creating error")

      if (response.already_exist) {
        this.sendMessage(chat, config.phrases.ALREADY_EXIST_MESSAGE)
        await new Promise(resolve => setTimeout(resolve, 1000))
      }

      await this.sendFiles(chat.id, from.username || from.id.toString(), response.conf, response.qr)

      this.bot.deleteMessage(chat.id, messageId)
      this.sendDoneMessage(chat)

      tgLogger.log(from, `✅ Client created server [${serverName}]`)

      if(client?.server) {
        const response = await revokeClient(client.server.ip, userId)
        if(!response?.success) {
          tgLogger.log(from, `❌ Error with client [${client.id}] deleting from [${serverName}]`)
          this.sendMessage(chat, config.phrases.SERVER_ERROR_MESSAGE)
          return
        }
      }

      if (!client) {
        const expiredAt = new Date()
        expiredAt.setMonth(expiredAt.getMonth() + 1)

        await entities.Client.save({
          user_id: from.id,
          chat_id: chat.id,
          server: { id: server.id },
          expired_at: expiredAt,
          ...(from.username && { username: from.username }),
          ...(from.first_name && { first_name: from.first_name }),
          ...(from.last_name && { last_name: from.last_name })
        })

        return
      }

      entities.Client.update({user_id: from.id}, {
        server: {id: server.id},
        ...(from.username && { username: from.username }),
        ...(from.first_name && { first_name: from.first_name }),
        ...(from.last_name && { last_name: from.last_name })

      })

    } catch (error: any) {
      tgLogger.error(from, error)
      this.sendMessage(chat, config.phrases.ERROR_MESSAGE)
    }
  }

  private async invoice(from: User, chat: Chat, tariff: PayTariff) {
    const client = await this.getClient(from)
    if(!client) {
      tgLogger.log(from, `❌ Client ${from.id} not found`)
      this.sendMessage(chat, config.phrases.SERVER_ERROR_MESSAGE)
      return
    }

    const tariffName = getTariffName(tariff)
    const months = getTariffMonths(tariff)

    const expiredAt = new Date(client.expired_at)
    const paidUntil = getSubscriptionExpiredDate(new Date(expiredAt.setMonth(expiredAt.getMonth() + months)))

    await this.bot.sendInvoice(
      chat.id,
      'Оплата подписки\n\n',
      `\n\nПродление на ${tariffName}. Ваша подписка будет продлена до ${paidUntil}`,
      tariffName,
      config.providerToken,
      config.currency,
      [{label: tariffName, amount: tariff * 100}]
    )
  }

  private async subscription(from: User, chat: Chat) {
    const client = await this.getClientWithServer(from)
    if(!client?.server) return this.sendNotFoundMessage(chat)

    this.sendSubscriptionMessage(chat, client?.server.label, client.expired_at)
  }

  private async files(from: User, chat: Chat) {
    const userId = from.id

    const client = await this.getClientWithServer(from)
    if(!client?.server) return this.sendNotFoundMessage(chat)

    const response = await createClient(client.server.ip, userId)
    if (!response.success || !response.already_exist) throw Error("Find already created client")

      await this.sendFiles(chat.id, from.username || from.id.toString(), response.conf, response.qr)

      this.sendDoneMessage(chat)
  }

  private async sendFiles(chatId: number, userName: string, conf: string, qr: string,) {
    await this.bot.sendDocument(
      chatId,
      Buffer.from(conf, "base64"),
      {},
      { filename: `fídar-vpn-${userName}.conf` }
    )
    await this.bot.sendPhoto(chatId, Buffer.from(qr, "base64"), {}, { filename: `fídar-vpn-${userName}` })

    await new Promise(resolve => setTimeout(resolve, 1000))
  }

  private async sendStartMessage(from: User, chat: Chat) {
    const client = await this.getClient(from)

    const inlineKeyboard = [
      !client ? config.inlineKeyboardItem.trial : config.inlineKeyboardItem.subscription,
      config.inlineKeyboardItem.support,
    ]

    this.sendMessage(chat, config.phrases.START_MESSAGE, inlineKeyboard)
  }

  private sendLocationMessage(chat: Chat, servers: Array<Server>, exist: boolean) {
    const data = servers.map(server => ({text: server.label, callback_data: `create:${server.name}`}))
    this.sendMessage(chat, exist ? config.phrases.LOCATION_WITH_EXIST_MESSAGE : config.phrases.LOCATION_MESSAGE, [data, exist ? config.inlineKeyboardItem.subscription : []])
  }

  private sendDoneMessage(chat: Chat) {
    this.sendMessage(chat, config.phrases.DONE_MESSAGE, config.inlineKeyboard.manual)
  }

  private async sendPayMessage(from: User, chat: Chat) {
    const client = await this.getClient(from)
    if(!client) return  this.sendMessage(chat, config.phrases.PAY_NEW_USER_MESSAGE, [config.inlineKeyboardItem.main])

    this.sendMessage(chat, config.phrases.PAY_MESSAGE, [...config.inlineKeyboard.tariffs, config.inlineKeyboardItem.subscription])
  }

  private sendManualMessage(chat: Chat) {
    this.sendMessage(chat, config.phrases.MANUAL_MESSAGE, config.inlineKeyboard.manual)
  }

  private sendHelpMessage(chat: Chat) {
    this.sendMessage(chat, config.phrases.HELP_MESSAGE)
  }

  private sendNotFoundMessage(chat: Chat) {
    this.sendMessage(chat, config.phrases.NOT_FOUND_MESSAGE, [config.inlineKeyboardItem.main])
  }

  private sendNeedPayMessage(chat: Chat) {
    this.sendMessage(chat, config.phrases.NEED_PAY_MESSAGE, [config.inlineKeyboardItem.pay])
  }

  private sendSuccessfulPaymentMessage(chat: Chat) {
    this.sendMessage(chat, config.phrases.SUCCESSFUL_PAYMENT_MESSAGE, [config.inlineKeyboardItem.subscription])
  }

  private sendSubscriptionMessage(chat: Chat, serverLabel: string, expiredAt: Date) {
    const paidUntil = getSubscriptionExpiredDate(expiredAt)

    const inlineKeyboard = [
      config.inlineKeyboardItem.pay,
      config.inlineKeyboardItem.location,
      config.inlineKeyboardItem.files,
    ]
    this.sendMessage(chat, `${config.phrases.SUBSCRIPTION_MESSAGE} ${serverLabel}\n💵└ Оплачено до: ${paidUntil || '-'}`, inlineKeyboard)
  }

  private sendMessage(chat: Chat, message: string, inlineKeyboard?: Array<Array<InlineKeyboardButton>>) {
    if(!inlineKeyboard) return this.bot.sendMessage(chat.id, message)

    this.bot.sendMessage(chat.id, message, {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: inlineKeyboard
      }
    })
  }

  private getClient(from: User): Promise<Client | null> {
    return entities.Client.findOne({ where: { user_id: from.id } })
  }

  private getClientWithServer(from: User): Promise<Client | null> {
    return entities.Client.findOne({ where: { user_id: from.id }, relations: { server: true } })
  }
}

new Telegram().process()
