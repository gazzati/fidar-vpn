import dotenv from "dotenv"
import Joi from "joi"
import { readFileSync } from "fs"

dotenv.config()

const envVarsSchema = Joi.object({
  TELEGRAM_TOKEN: Joi.string().description("Telegram token")
})

const { error, value: envVars } = envVarsSchema.validate(process.env)
if (error) new Error(`Config validation error: ${error.message}`)

const getWgParams = (): WgParams => {
  const file = readFileSync("/etc/wireguard/params", "utf-8")
  if (!file) throw Error('Get wireguard params error')

  const params = file.split("\n")
  if (!params) throw Error('Get wireguard params error')

  const result: WgParams = {
    SERVER_PUB_IP: '',
    SERVER_PUB_NIC: '',
    SERVER_WG_NIC: '',
    SERVER_WG_IPV4: '',
    SERVER_WG_IPV6: '',
    SERVER_PORT: '',
    SERVER_PRIV_KEY: '',
    SERVER_PUB_KEY: '',
    CLIENT_DNS_1: '',
    CLIENT_DNS_2: '',
    ALLOWED_IPS: ''
  }

  Object.keys(result).map(key => {
    for (const param of params) {
      if (param.includes(`${key}=`)) {
        const value = param.replace(`${key}=`, "")
        if (!value) continue

        result[key as keyof WgParams] = value
      }
    }

    if (!result[key as keyof WgParams]) throw Error(`${key} not found`)
  })

  return result
}

export default {
  telegramToken: envVars.TELEGRAM_TOKEN,

  wgParams: getWgParams(),

  phrases: {
    START_MESSAGE: "*Добро пожаловать в FídarVPN* \n\n🚀 Высокосоростной анонимный VPN с безлимтным трафиком \n\n",
    HELP_MESSAGE: "По всем вопросам пиши @gazzati",
    ERROR_MESSAGE: "🤷‍♂️ Что то пошло не так, попробуйте повторить позже",
    ALREADY_EXIST_MESSAGE: "🤝 У вас уже есть конфигурация",
    DONE_MESSAGE: "✅ Готово, отсканируй QR код с конфигурацией или используй файл с конфигурацией",
    MANUAL_MESSAGE: "⚙️ Инструкция по установке: \n\n1️⃣ Установите приложение WireGuard по ссылке ниже\n\n2️⃣ Импортируйте полученный файл в приложение WireGuard либо отсканируйте QR \n\n3️⃣ Для включения/отключения VPN активируйте добавленное подключение\n\n"
  },

  inlineKeyboard: {
    start: [[{ text: "🌎 Получить VPN", callback_data: "vpn" }]],
    done: [[{ text: "📝 Инструкция", callback_data: "manual" }]],
    manual: [
      [
        { text: "📲 Приложение для Iphone", url: "https://itunes.apple.com/us/app/wireguard/id1441195209?ls=1&mt=8" },
        { text: "📱 Приложение для Android", url: "https://play.google.com/store/apps/details?id=com.wireguard.android" }
      ],
      [
        { text: "💻 Приложение для macOS", url: "https://apps.apple.com/ru/app/wireguard/id1451685025" },
        { text: "🖥️ Приложение для Windows", url: "https://download.wireguard.com/windows-client/wireguard-installer.exe" }
      ]
    ],
  }
}
