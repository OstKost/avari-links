import { useEffect } from 'react';
import { useTranslation } from '@/shared/i18n';

/**
 * Hook to synchronize document title, html lang, and meta description with current language.
 */
export function useSeoHead() {
  const { language, t } = useTranslation();

  useEffect(() => {
    // 1. Update html lang attribute
    document.documentElement.lang = language;

    // 2. Update document title
    document.title = t.seo.title;

    // 3. Update meta description
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', t.seo.description);
    }

    // 4. Update OpenGraph title and description if present
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) {
      ogTitle.setAttribute('content', t.seo.title);
    }
    const ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogDesc) {
      ogDesc.setAttribute('content', t.seo.description);
    }

    const twitterTitle = document.querySelector('meta[name="twitter:title"]');
    if (twitterTitle) {
      twitterTitle.setAttribute('content', t.seo.title);
    }
    const twitterDesc = document.querySelector('meta[name="twitter:description"]');
    if (twitterDesc) {
      twitterDesc.setAttribute('content', t.seo.description);
    }
  }, [language, t]);
}
