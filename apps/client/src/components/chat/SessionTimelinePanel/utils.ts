export function sanitizeId(value: string) {
  return value.replace(/\W/g, '_')
}

export function parseTime(value: string) {
  const [hours, minutes, seconds] = value.split(':').map(Number)
  return (hours || 0) * 3600 + (minutes || 0) * 60 + (seconds || 0)
}

export function normalizeTime(value: string) {
  const [hours, minutes, seconds] = value.split(':')
  const normalizePart = (part?: string) => {
    const parsed = Number.parseInt(part ?? '0', 10)
    if (Number.isFinite(parsed)) {
      return `${parsed}`.padStart(2, '0')
    }
    return '00'
  }
  return `${normalizePart(hours)}:${normalizePart(minutes)}:${normalizePart(seconds)}`
}
