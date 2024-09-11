import dotenv from "dotenv"
import Joi from "joi"

dotenv.config()

const envVarsSchema = Joi.object({
  TELEGRAM_TOKEN: Joi.string().description("Telegram token"),
})

const { error, value: envVars } = envVarsSchema.validate(process.env)
if (error) new Error(`Config validation error: ${error.message}`)

export default {
  telegramToken: envVars.TELEGRAM_TOKEN,

  phrases: {
    START_MESSAGE: "*Добро пожаловать в FídarVPN* \n\n🚀 Высокосоростной анонимный VPN с безлимтным трафиком \n\n",
    HELP_MESSAGE: "По всем вопросам пиши @gazzati",
    ERROR_MESSAGE: "Что то пошло не так, попробуйте повторить позже",
  },

  inlineKeyboard: [
    [{text: 'Хочу VPN', callback_data: 'vpn'}]
  ]
}
