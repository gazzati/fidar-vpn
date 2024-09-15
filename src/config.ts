import dotenv from "dotenv"
import Joi from "joi"

import {PayTariff} from '@interfaces/pay';

dotenv.config()

const envVarsSchema = Joi.object({
  TELEGRAM_TOKEN: Joi.string().description("Telegram token"),

  PSQL_HOST: Joi.string().default("localhost").description("Database Host"),
  PSQL_DATABASE: Joi.string().default("database").description("Database Name"),
  PSQL_USER: Joi.string().default("root").description("Database User"),
  PSQL_PASSWORD: Joi.string().allow("").default("root").description("Database Password")
})

const { error, value: envVars } = envVarsSchema.validate(process.env)
if (error) new Error(`Config validation error: ${error.message}`)

 const callbackData = {
  start: 'start',
  create: 'create',
  manual: 'manual',
  files: 'files',
  location: 'location',
  subscription: 'subscription',
  pay: 'pay',
  tariff: 'tariff',
  support: 'support',
 }

export default {
  telegramToken: envVars.TELEGRAM_TOKEN,

  psqlHost: envVars.PSQL_HOST,
  psqlDatabase: envVars.PSQL_DATABASE,
  psqlUsername: envVars.PSQL_USER,
  psqlPassword: envVars.PSQL_PASSWORD,

  serversPort: 3003,

  phrases: {
    START_MESSAGE: "*Добро пожаловать в Fídar VPN* \n\n🚀 Высокоскоростной анонимный VPN с безлимитным трафиком \n\n🌎 Локации: 🇸🇪 🇪🇪 🇷🇺 \n\n💵 Оплата картой и SberPay",
    LOCATION_MESSAGE: "*Выберите расположение сервера:* \n\n💡 Локацию можно будет сменить в меню подписки\n\n",
    LOCATION_WITH_EXIST_MESSAGE: "*Выберите расположение сервера:* \n\n💡 Локацию можно будет сменить в меню подписки\n\n⚠️ Обратите внимание, после изменения локации предыдущий файл подключения свою работу прекращает",
    HELP_MESSAGE: "По всем вопросам пиши @gazzati",
    ERROR_MESSAGE: "🤷‍♂️ Что то пошло не так, попробуйте повторить позже",
    SERVER_ERROR_MESSAGE: "Данный сервер неисправен, попробуй другой",
    ALREADY_EXIST_MESSAGE: "🤝 У вас уже есть конфигурация",
    DONE_MESSAGE: "✅ Готово, отсканируй QR код с конфигурацией или используй файл с конфигурацией",
    NOT_FOUND_MESSAGE: "🙅 У вас нет подписки",
    SUBSCRIPTION_MESSAGE: "📌└ Статус подписки: активная \n🌐└ Сервер:",
    PAY_MESSAGE: "💵 Выберите сумму для пополнения: \n\nОплата возможна Банковской картой и SberPay",
    PAY_NEW_USER_MESSAGE: "🫶 Мы ценим наших клиентов и поэтому рекомендуем сначала воспользоваться бесплатным периодом",
    NEED_PAY_MESSAGE: "💵 Необходимо произвести оплату",
    MANUAL_MESSAGE:
      "⚙️ Инструкция по установке: \n\n1️⃣ Установите приложение WireGuard по ссылке ниже\n\n2️⃣ Импортируйте полученный файл в приложение WireGuard либо отсканируйте QR \n\n3️⃣ Для включения/отключения VPN активируйте добавленное подключение\n\n"
  },


  callbackData,

  inlineKeyboardItem: {
    subscription: [{ text: "📌 Моя подписка", callback_data: callbackData.subscription }],
    main: [{ text: "🔙 Вернуться на главную", callback_data: callbackData.start }],
    trial: [{ text: "🎁 Пробная подписка", callback_data: callbackData.location }],
    pay: [{ text: "💵 Оплатить", callback_data: callbackData.pay }],
    support: [{ text: "❓ Поддержка", callback_data: callbackData.support }],
    files: [{ text: "💾 Скачать данные для подключения", callback_data: callbackData.files }],
    location: [{ text: "📍 Сменить локацию", callback_data: callbackData.location }],
    manual: [{ text: "📝 Инструкция", callback_data: callbackData.manual }],
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
      [{ text: "📌 Моя подписка", callback_data: callbackData.subscription }]
    ],

    tariffs: [
      [{ text: `${PayTariff.Month}₽ - 1 Месяц`, callback_data: `${callbackData.tariff}:${PayTariff.Month}` }],
      [{ text: `${PayTariff.Month3}₽ - 3 Месяца`, callback_data: `${callbackData.tariff}:${PayTariff.Month3}` }],
      [{ text: `${PayTariff.Year}₽ - 1 Год`, callback_data: `${callbackData.tariff}:${PayTariff.Year}` }],
    ],
  }
}
