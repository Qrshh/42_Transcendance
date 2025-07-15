import {ref, computed } from 'vue'
import en from './locales/en'
import fr from './locales/fr'
import es from './locales/es'

type Lang = 'en' | 'fr' | 'es'

const messages = { en, fr, es}
const defaultLang: Lang = 'en'

const currentLang = ref<Lang>(
	(localStorage.getItem('lang') as Lang) || defaultLang
)

export function setLang(lang: Lang){
	if(messages[lang]){
		currentLang.value = lang
		localStorage.setItem('lang', lang)
	}
}

export const t = computed(() => messages[currentLang.value])
export const getCurrentLang = () => currentLang.value


