
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

const padZeros = (value: string | number): string => {
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


const logger = {
    debug(...args: Array<any>) {
        const dateLog = getLogDate()

         // eslint-disable-next-line no-console
        console.log(`${Color.Cyan}${dateLog} ${Color.Green}`, ...args)

    },

    error(message: any) {
        const dateLog = getLogDate()

        // eslint-disable-next-line no-console
        console.log(`${Color.Red}${dateLog} ${message}`)
    }
}

export default logger
