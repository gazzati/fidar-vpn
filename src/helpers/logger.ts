/* eslint-disable no-console */
import { User } from "node-telegram-bot-api"

enum Color {
  Reset = "\x1b[0m",
  Red = "\x1b[31m",
  Green = "\x1b[32m",
  Yellow = "\x1b[33m",
  Blue = "\x1b[34m",
  Magenta = "\x1b[35m",
  Cyan = "\x1b[36m",
  White = "\x1b[37m",
  DarkBlue = "\x1b[94m"
}

const padZeros = (value: number): string => {
  if (value.toString().length < 2) {
    const zeros = 2 - value.toString().length
    const str = new Array(zeros).fill(0)
    return `${str.join("")}${value}`
  }

  return value.toString()
}

export const getLogDate = (today = new Date()): string => {
  const date = `${padZeros(today.getDate())}.${padZeros(today.getMonth() + 1)}.${padZeros(today.getFullYear())}`
  const time = `${padZeros(today.getHours())}:${padZeros(today.getMinutes())}`

  return `[${date} ${time}]`
}

export const log = (...args: Array<any>) => {
  const dateLog = getLogDate()
  console.log(`${Color.Cyan}${dateLog}${Color.Green}`, ...args)
}

export const error = (...args: Array<any>) => {
  const dateLog = getLogDate()
  console.log(`${Color.Red}${dateLog}`, ...args)
}

export const tgLogger = {
  log(from: User, message: string) {
    const dateLog = getLogDate()

    const userDetails = from.username ? `@${from.username}` : `(${from.first_name})`
    const user = `👨‍💻 [${from.id}] ${userDetails}`

    console.log(`${Color.Cyan}${dateLog} ${Color.Green}${user} -> ${Color.Magenta}`, message)
  },

  error(from: User, message: any) {
    const dateLog = getLogDate()

    const userDetails = from.username ? `@${from.username}` : `(${from.first_name})`
    const user = `👨‍💻 [${from.id}] ${userDetails}`

    console.log(`${Color.Red}${dateLog} ${user} ❌`, message)
  }
}

class Logger {
  constructor(private name: string) {}

  log(...args: Array<any>) {
    const dateLog = getLogDate()
    console.log(`${Color.Cyan}${dateLog} ${Color.Yellow}[${this.name}]`, ...args)
  }

  error(...args: Array<any>) {
    const dateLog = getLogDate()
    console.log(`${Color.Red}${dateLog} ${Color.Yellow}[${this.name}]`, ...args)
  }
}

export default Logger
