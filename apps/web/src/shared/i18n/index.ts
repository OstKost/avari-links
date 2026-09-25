import { useAppStore } from '@/shared/store/app-store';
import { translations, type Language, type Translations } from './translations';

export { translations, type Language, type Translations };

export function useTranslation() {
  const language = useAppStore((s) => s.language);
  const setLanguage = useAppStore((s) => s.setLanguage);
  const toggleLanguage = useAppStore((s) => s.toggleLanguage);

  const t: Translations = translations[language];

  return {
    language,
    t,
    setLanguage,
    toggleLanguage,
  };
}

export function getTranslation(language: Language = 'ru'): Translations {
  return translations[language] || translations.ru;
}
