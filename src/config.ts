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
    ERROR_MESSAGE: "Что то пошло не так, попробуйте повторить позже"
  },

  inlineKeyboard: [[{ text: "Хочу VPN", callback_data: "vpn" }]]
}
