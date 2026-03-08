import { tgLogger } from "@helpers/logger"
import { TelegramCommand } from "@interfaces/telegram"
import MessageService from "@services/messages"

import { type User, type Chat } from "node-telegram-bot-api"

import CallbackHandler from "./callback-handler"

export const COMMANDS: Array<string> = [
  TelegramCommand.Start,
  TelegramCommand.Subscription,
  TelegramCommand.Pay,
  TelegramCommand.Help
]

class CommandHandler {
  constructor(
    private messages: MessageService,
    private callbacks: CallbackHandler
  ) {}

  public handle(from: User, chat: Chat, action: string) {
    tgLogger.log(from, `📋 Command ${action}`)

    switch (action) {
      case TelegramCommand.Start:
        return this.messages.sendStart(from, chat)
      case TelegramCommand.Subscription:
        return this.callbacks.subscription(from, chat)
      case TelegramCommand.Pay:
        return this.messages.sendPay(from, chat)
      case TelegramCommand.Help:
        return this.messages.sendHelp(chat)
    }
  }
}

export default CommandHandler
