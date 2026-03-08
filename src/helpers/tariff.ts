import { PayTariff, TariffName, TELEGRAM_STARS_CURRENCY } from "@interfaces/pay"

export const getTariffName = (tariff: PayTariff) => {
  switch (tariff) {
    case PayTariff.Month:
      return TariffName.Month
    case PayTariff.Month3:
      return TariffName.Month3
    case PayTariff.Year:
      return TariffName.Year
  }
}

export const getTariffMonths = (tariff: PayTariff) => {
  switch (tariff) {
    case PayTariff.Month:
      return 1
    case PayTariff.Month3:
      return 3
    case PayTariff.Year:
      return 12
  }
}

export const isTelegramStarsCurrency = (currency: string): boolean => currency.toUpperCase() === TELEGRAM_STARS_CURRENCY

export const getInvoiceAmount = (tariff: PayTariff, currency: string): number => {
  if (isTelegramStarsCurrency(currency)) return tariff
  return tariff * 100
}

export const getPaidAmount = (totalAmount: number, currency: string): number => {
  if (isTelegramStarsCurrency(currency)) return totalAmount
  return totalAmount / 100
}
