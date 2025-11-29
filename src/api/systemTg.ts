import axios from "axios"

import config from "@root/config"

const baseUrl = `https://api.telegram.org/bot${config.systemTelegramToken}`

export const sendMessage = async (text: string): Promise<any> => {
  const response = await axios.post(
    `${baseUrl}/sendMessage`,
    {
      chat_id: config.systemTelegramChatId,
      text
    },
    { timeout: 5_000 }
  )
  return response?.data
}
