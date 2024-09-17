import axios from "axios"
import { type InlineKeyboardButton } from "node-telegram-bot-api"

import config from "@root/config"

const baseUrl = `https://api.telegram.org/bot${config.telegramToken}`

export const sendMessage = async (
  chatId: string,
  message: string,
  inlineKeyboard?: Array<Array<InlineKeyboardButton>>
): Promise<any> => {
  const response = await axios.post(
    `${baseUrl}/sendMessage`,
    {
      chat_id: chatId,
      text: message,
      ...(inlineKeyboard && { reply_markup: { inline_keyboard: inlineKeyboard } })
    },
    { timeout: 5_000 }
  )
  return response.data
}
