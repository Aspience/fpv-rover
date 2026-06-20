export const formatTimestamp = (timestamp: number, locale: string): string => {
  const date = new Date(timestamp)
  const day = date.toLocaleDateString(locale, { day: '2-digit', month: '2-digit' })
  const time = date.toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  return `${day} ${time}`
}

export const formatVersion = (version: string): string =>
  version.startsWith('v') ? version : `v${version}`
