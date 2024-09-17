const padZeros = (value: number): string => {
  if (value.toString().length < 2) {
    const zeros = 2 - value.toString().length
    const str = new Array(zeros).fill(0)
    return `${str.join("")}${value}`
  }

  return value.toString()
}

const getTimeLeft = (monthDiff: number, dayDiff: number) => {
  if (monthDiff >= 12) return "более года"

  if (monthDiff >= 5) return `${monthDiff} месяцев`
  if (monthDiff > 1) return `${monthDiff} месяца`
  if (monthDiff > 0) return "1 месяц"

  if (dayDiff >= 5) return `${dayDiff} дней`
  if (dayDiff > 1) return `${dayDiff} дня`
  return "1 день"
}

export const getSubscriptionExpiredDate = (expiredAt: Date): string | null => {
  const expired = new Date(expiredAt)
  const now = new Date()

  if (now > expired) return null

  const timeDiff = expired.getTime() - now.getTime()

  const monthDiff = Math.round(timeDiff / (1000 * 3600 * 24 * 30))
  const dayDiff = Math.round(timeDiff / (1000 * 3600 * 24))

  const timeLeft = getTimeLeft(monthDiff, dayDiff)

  return `${padZeros(expired.getDate())}.${padZeros(expired.getMonth() + 1)}.${padZeros(
    expired.getFullYear()
  )}(${timeLeft})`
}

export const getNewExpiredAt = (expiredAt: Date, months: number): Date => {
  const expired = new Date(expiredAt)
  const now = new Date()

  const expiredDate = now > expired ? now : expired

  return new Date(expiredDate.setMonth(expiredDate.getMonth() + months))
}

export const getTrialExpiredAt = (): Date => {
  const expiredAt = new Date()
  expiredAt.setMonth(expiredAt.getMonth() + 1)
  return expiredAt
}

export const dbDate = (date: Date) => {
  return new Date(date).toISOString().slice(0, 19).replace("T", " ")
}
