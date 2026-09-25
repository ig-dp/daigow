import countries from '../countries.json'

// Generated once from mledoze/countries (ISO 3166-1 alpha-2) with Indonesian names from Intl.DisplayNames.
export const COUNTRIES: { code: string, name: string, name_en: string }[] = countries

const COUNTRY_BY_CODE = new Map(COUNTRIES.map(country => [country.code, country]))

export function isCountryCode(value: unknown): value is string {
  return typeof value === 'string' && COUNTRY_BY_CODE.has(value)
}

// Trips created before the country picker stored free text, so unknown values are shown as-is.
export function countryName(code?: string | null) {
  if (!code) return ''
  return COUNTRY_BY_CODE.get(code)?.name ?? code
}

// Empty for free-text destinations from older trips, so callers can v-if on it.
export function countryFlagIcon(code?: string | null) {
  return isCountryCode(code) ? `flag:${code.toLowerCase()}-1x1` : ''
}

// AppSelect options with flag-icons (@iconify-json/flag); keywords let sellers search by English name or code too ("Japan", "JP").
export const COUNTRY_OPTIONS = COUNTRIES.map(country => ({
  value: country.code,
  label: country.name,
  keywords: `${country.name_en} ${country.code}`,
  icon: countryFlagIcon(country.code)
}))
