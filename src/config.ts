import dotenv from "dotenv"
import Joi from "joi"

import { CardTariff, TariffName } from "@interfaces/pay"
import { buildCallbackData, CallbackAction } from "@root/telegram/callback-data"

dotenv.config()

const envVarsSchema = Joi.object({
  TELEGRAM_TOKEN: Joi.string().trim().required().description("Telegram token"),
  SYSTEM_TELEGRAM_TOKEN: Joi.string().trim().allow("").default("").description("System telegram token"),
  SYSTEM_TELEGRAM_CHAT_ID: Joi.string().trim().allow("").default("").description("System telegram chat id"),
  TELEGRAM_IP_FAMILY: Joi.number().valid(4, 6).optional().description("Force Telegram API IPv4 or IPv6"),

  PSQL_HOST: Joi.string().default("localhost").description("Database Host"),
  PSQL_DATABASE: Joi.string().default("database").description("Database Name"),
  PSQL_USER: Joi.string().default("root").description("Database User"),
  PSQL_PASSWORD: Joi.string().allow("").default("root").description("Database Password"),

  PROVIDER_TOKEN: Joi.string().allow("").default("").description("Provider token")
})

const { error, value: envVars } = envVarsSchema.validate(process.env, { allowUnknown: true })
if (error) throw new Error(`Config validation error: ${error.message}`)

const hasSystemTelegramToken = Boolean(envVars.SYSTEM_TELEGRAM_TOKEN)
const hasSystemTelegramChatId = Boolean(envVars.SYSTEM_TELEGRAM_CHAT_ID)

if (hasSystemTelegramToken !== hasSystemTelegramChatId) {
  throw new Error("Config validation error: SYSTEM_TELEGRAM_TOKEN and SYSTEM_TELEGRAM_CHAT_ID must be set together")
}

const isSystemTelegramEnabled = hasSystemTelegramToken && hasSystemTelegramChatId

const callbackData = {
  start: CallbackAction.Start,
  changeServer: CallbackAction.ChangeServer,
  manual: CallbackAction.Manual,
  files: CallbackAction.Files,
  locations: CallbackAction.Locations,
  subscription: CallbackAction.Subscription,
  pay: CallbackAction.Pay,
  payCard: CallbackAction.PayCard,
  payStars: CallbackAction.PayStars,
  tariff: CallbackAction.Tariff,
  tariffCard: CallbackAction.TariffCard,
  tariffStars: CallbackAction.TariffStars,
  support: CallbackAction.Support,
  promo: CallbackAction.Promo,
  trial: CallbackAction.Trial
}

export default {
  telegramToken: envVars.TELEGRAM_TOKEN,
  systemTelegramToken: envVars.SYSTEM_TELEGRAM_TOKEN || null,
  systemTelegramChatId: isSystemTelegramEnabled ? Number(envVars.SYSTEM_TELEGRAM_CHAT_ID) : null,
  isSystemTelegramEnabled,
  telegramIpFamily: envVars.TELEGRAM_IP_FAMILY ?? null,

  psqlHost: envVars.PSQL_HOST,
  psqlDatabase: envVars.PSQL_DATABASE,
  psqlUsername: envVars.PSQL_USER,
  psqlPassword: envVars.PSQL_PASSWORD,

  providerToken: envVars.PROVIDER_TOKEN,

  serversPort: 3003,

  phrases: {
    START_MESSAGE:
      "*Добро пожаловать в Fídar VPN* \n\n🚀 Высокоскоростной анонимный VPN с безлимитным трафиком \n\n🌎 Локации: 🇸🇪 🇪🇪 🇷🇺 \n\n💵 Оплата картой или Telegram Stars",
    CHANGE_SERVER_MESSAGE:
      "*Выберите расположение сервера:* \n\n💡 Локацию можно будет сменить в меню подписки\n\n⚠️ Обратите внимание, после изменения локации предыдущий файл подключения свою работу прекращает",
    HELP_MESSAGE: "По всем вопросам пиши @gazzati",
    ERROR_MESSAGE: "🤷‍♂️ Что то пошло не так, попробуйте повторить позже",
    DONE_MESSAGE: "✅ Готово, отсканируй QR код или используй файл с конфигурацией",
    SUBSCRIPTION_NOT_FOUND_MESSAGE: "🙅 У вас нет подписки",
    PAY_MESSAGE: "💵 Выберите способ оплаты",
    PAY_CARD_MESSAGE:
      "💳 Выберите сумму для пополнения: \n\nОплата банковской картой. Если у вас есть промокод - нажмите кнопку ниже",
    PAY_STARS_MESSAGE: "⭐ Выберите сумму для пополнения в Telegram Stars",
    PAY_NEW_USER_MESSAGE:
      "🫶 Мы ценим наших клиентов и поэтому рекомендуем сначала воспользоваться бесплатным периодом",
    NEED_PAY_MESSAGE: "💵 Необходимо произвести оплату",
    SUCCESSFUL_PAYMENT_MESSAGE: "👍 Оплата прошла успешно",
    SUCCESSFUL_PROMO_MESSAGE: "👍 Промокод успешно применен",
    FAILED_PAYMENT_MESSAGE: "😢 Извините, что то пошло не так. Попробуйте позже",
    SEND_PROMO_MESSAGE: "😎 Отправьте промокод в чат",
    PROMO_NOT_FOUND_MESSAGE: "😔 Промокод не найден",
    MANUAL_MESSAGE:
      "⚙️ Инструкция по установке: \n\n1️⃣ Установите приложение WireGuard по ссылке ниже\n\n2️⃣ Импортируйте полученный файл в приложение WireGuard либо отсканируйте QR \n\n3️⃣ Для включения/отключения VPN активируйте добавленное подключение\n\n",

    EXPIRED_SUBSCRIPTION_MESSAGE: "ℹ️ Ваша подсписка завершена \n\nДля продления подписки требуется оплата",
    EXPIRED_TRIAL_MESSAGE: "ℹ️ Ваш пробный период был завершен \n\nДля продления подписки требуется оплата",

    REMINDER_SUBSCRIPTION_MESSAGE:
      "⚠️ Ваша подсписка подходит к концу \n\nДля продления подписки требуется оплата. \n\nЕсли до завтра не пополнить баланс - VPN перестанет работать 😿",
    REMINDER_TRIAL_MESSAGE:
      "⚠️ Пробный период подходит к концу \n\nДля продления подписки требуется оплата. \n\nЕсли до завтра не пополнить баланс - VPN перестанет работать 😿"
  },

  callbackData,

  inlineKeyboardItem: {
    subscription: [{ text: "📌 Моя подписка", callback_data: callbackData.subscription }],
    main: [{ text: "🔙 Вернуться на главную", callback_data: callbackData.start }],
    trial: [{ text: "🎁 Пробная подписка", callback_data: callbackData.trial }],
    pay: [{ text: "💵 Оплатить", callback_data: callbackData.pay }],
    payCard: [{ text: "💳 Банковская карта", callback_data: callbackData.payCard }],
    payStars: [{ text: "⭐ Telegram Stars", callback_data: callbackData.payStars }],
    promo: [{ text: "🏷️ Ввести промокод", callback_data: callbackData.promo }],
    support: [{ text: "❓ Поддержка", callback_data: callbackData.support }],
    files: [{ text: "💾 Скачать данные для подключения", callback_data: callbackData.files }],
    locations: [{ text: "📍 Выбрать локацию", callback_data: callbackData.locations }],
    manual: [{ text: "📝 Инструкция", callback_data: callbackData.manual }]
  },

  inlineKeyboard: {
    manual: [
      [
        { text: "📲 Iphone", url: "https://itunes.apple.com/us/app/wireguard/id1441195209?ls=1&mt=8" },
        { text: "📱 Android", url: "https://play.google.com/store/apps/details?id=com.wireguard.android" }
      ],
      [
        { text: "💻 macOS", url: "https://apps.apple.com/ru/app/wireguard/id1451685025" },
        { text: "🖥️ Windows", url: "https://download.wireguard.com/windows-client/wireguard-installer.exe" }
      ],
      [{ text: "🔙 Вернуться на главную", callback_data: callbackData.start }]
    ],

    tariffs: [
      [
        {
          text: `${CardTariff.Month}₽ - ${TariffName.Month}`,
          callback_data: buildCallbackData(CallbackAction.TariffCard, CardTariff.Month)
        }
      ],
      [
        {
          text: `${CardTariff.Month3}₽ - ${TariffName.Month3}`,
          callback_data: buildCallbackData(CallbackAction.TariffCard, CardTariff.Month3)
        }
      ],
      [
        {
          text: `${CardTariff.Year}₽ - ${TariffName.Year}`,
          callback_data: buildCallbackData(CallbackAction.TariffCard, CardTariff.Year)
        }
      ],
      [{ text: "🏷️ Ввести промокод", callback_data: callbackData.promo }]
    ]
  }
}
