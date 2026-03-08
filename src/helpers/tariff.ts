import { CardTariff, PayMethod, PaymentCurrency, StarsTariff, TariffName } from "@interfaces/pay"

export const isTelegramStarsCurrency = (currency: string): boolean =>
  currency.toUpperCase() === PaymentCurrency.Stars

export const getTariffName = (method: PayMethod, tariff: number): TariffName | undefined => {
  if (method === PayMethod.Card) {
    switch (tariff) {
      case CardTariff.Month:
        return TariffName.Month
      case CardTariff.Month3:
        return TariffName.Month3
      case CardTariff.Year:
        return TariffName.Year
      default:
        return undefined
    }
  }

  switch (tariff) {
    case StarsTariff.Month:
      return TariffName.Month
    case StarsTariff.Month3:
      return TariffName.Month3
    case StarsTariff.Year:
      return TariffName.Year
    default:
      return undefined
  }
}

export const getTariffMonths = (method: PayMethod, tariff: number): number | undefined => {
  if (method === PayMethod.Card) {
    switch (tariff) {
      case CardTariff.Month:
        return 1
      case CardTariff.Month3:
        return 3
      case CardTariff.Year:
        return 12
      default:
        return undefined
    }
  }

  switch (tariff) {
    case StarsTariff.Month:
      return 1
    case StarsTariff.Month3:
      return 3
    case StarsTariff.Year:
      return 12
    default:
      return undefined
  }
}

export const getInvoiceAmount = (tariff: number, currency: string): number => {
  if (isTelegramStarsCurrency(currency)) return tariff
  return tariff * 100
}

export const getPaidAmount = (totalAmount: number, currency: string): number => {
  if (isTelegramStarsCurrency(currency)) return totalAmount
  return totalAmount / 100
}

export const getPayMethodByCurrency = (currency: string): PayMethod => {
  if (isTelegramStarsCurrency(currency)) return PayMethod.Stars
  return PayMethod.Card
}
