import "../aliases"

// Run once:
// yarn build && PSQL_HOST="127.0.0.1" node build/scripts/easter-gift.js

import TelegramBot from "node-telegram-bot-api"

import config from "@root/config"
import { AppDataSource, entities } from "@database/data-source"
import { dbDate, getNewExpiredAt } from "@helpers/date"
import { error, log } from "@helpers/logger"

const EASTER_MESSAGE = `Поздравляем вас со Светлой Пасхой!
Пусть праздник Воскресения Христова принесет в ваш дом мир, радость, надежду и душевное тепло.

В знак нашей благодарности мы дарим всем активным клиентам 1 месяц бесплатного пользования сервисом.
Бонус будет начислен автоматически, ничего дополнительно делать не нужно.

Спасибо, что вы с нами.
Желаем вам добра, благополучия и светлой Пасхи! ✨`

const MONTHS_GIFTED = 1
const DEFAULT_PAUSE_MS = 150

const sleep = async (ms: number) => {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

const bot = new TelegramBot(config.telegramToken)

const main = async () => {
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize()
  }

  const activeClients = await entities.Client.find({
    where: {
      active: true,
      username: 'gazzati'
    },
    order: { id: "ASC" }
  })

  log(`[easter-gift] active_clients=${activeClients.length}`)

  let granted = 0
  let failed = 0

  for (const client of activeClients) {
    try {
      const newExpiredAt = getNewExpiredAt(client.expired_at, MONTHS_GIFTED)

      await entities.Client.update(
        { id: client.id },
        {
          expired_at: dbDate(newExpiredAt),
          trial_used: true,
          active: true,
          was_reminded: false
        }
      )

      await bot.sendMessage(client.chat_id, EASTER_MESSAGE)

      granted += 1
      log(`[easter-gift] granted client_id=${client.id} user_id=${client.user_id} new_expired_at=${dbDate(newExpiredAt)}`)

      await sleep(DEFAULT_PAUSE_MS)
    } catch (e: any) {
      failed += 1
      error(`[easter-gift] failed client_id=${client.id} user_id=${client.user_id}`, e?.message || e)
    }
  }

  log(`[easter-gift] done granted=${granted} failed=${failed}`)
}

main()
  .catch((e) => error("[easter-gift] fatal", e))
  .finally(async () => {
    await AppDataSource.destroy().catch(() => null)
  })
