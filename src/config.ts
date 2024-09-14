import dotenv from "dotenv"
import Joi from "joi"

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

export default {
  telegramToken: envVars.TELEGRAM_TOKEN,

  psqlHost: envVars.PSQL_HOST,
  psqlDatabase: envVars.PSQL_DATABASE,
  psqlUsername: envVars.PSQL_USER,
  psqlPassword: envVars.PSQL_PASSWORD,

  serversPort: 3003,

  phrases: {
    START_MESSAGE: "*Добро пожаловать в FídarVPN* \n\n🚀 Высокоскоростной анонимный VPN с безлимтным трафиком \n\n",
    HELP_MESSAGE: "По всем вопросам пиши @gazzati",
    ERROR_MESSAGE: "🤷‍♂️ Что то пошло не так, попробуйте повторить позже",
    ALREADY_EXIST_MESSAGE: "🤝 У вас уже есть конфигурация",
    DONE_MESSAGE: "✅ Готово, отсканируй QR код с конфигурацией или используй файл с конфигурацией",
    MANUAL_MESSAGE:
      "⚙️ Инструкция по установке: \n\n1️⃣ Установите приложение WireGuard по ссылке ниже\n\n2️⃣ Импортируйте полученный файл в приложение WireGuard либо отсканируйте QR \n\n3️⃣ Для включения/отключения VPN активируйте добавленное подключение\n\n"
  },

  inlineKeyboard: {
    start: [[{ text: "🌎 Получить VPN", callback_data: "vpn" }]],
    done: [[{ text: "📝 Инструкция", callback_data: "manual" }]],
    manual: [
      [
        { text: "📲 Iphone", url: "https://itunes.apple.com/us/app/wireguard/id1441195209?ls=1&mt=8" },
        { text: "📱 Android", url: "https://play.google.com/store/apps/details?id=com.wireguard.android" }
      ],
      [
        { text: "💻 macOS", url: "https://apps.apple.com/ru/app/wireguard/id1451685025" },
        { text: "🖥️ Windows", url: "https://download.wireguard.com/windows-client/wireguard-installer.exe" }
      ]
    ]
  }
}
