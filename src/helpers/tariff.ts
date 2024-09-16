import { PayTariff, TariffName } from "@interfaces/pay"

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
