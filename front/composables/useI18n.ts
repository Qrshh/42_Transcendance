import { t, setLang, getCurrentLang } from '../lang/i18n'

export function useI18n() {
  const onLangChange = (e: Event) => {
    const value = (e.target as HTMLSelectElement).value
    if (value === 'en' || value === 'fr' || value === 'es') {
      setLang(value)
    }
  }

  return {
    t,
    setLang,
    currentLang: getCurrentLang(),
    onLangChange,
  }
}

