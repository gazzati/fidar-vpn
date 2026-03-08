export enum CallbackAction {
  Start = "start",
  ChangeServer = "change-server",
  Manual = "manual",
  Files = "files",
  Locations = "locations",
  Subscription = "subscription",
  Pay = "pay",
  Tariff = "tariff",
  Support = "support",
  Promo = "promo",
  Trial = "trial"
}

export const buildCallbackData = (action: CallbackAction, param?: string | number): string => {
  if (param === undefined) return action
  return `${action}:${param}`
}

export const parseCallbackData = (data: string): { action: CallbackAction; param?: string } | null => {
  const [action, ...parts] = data.split(":")
  if (!Object.values(CallbackAction).includes(action as CallbackAction)) return null

  const param = parts.length > 0 ? parts.join(":") : undefined

  return { action: action as CallbackAction, param }
}
