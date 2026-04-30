import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getSetting, setSetting } from '../services/database';
import zh from './zh.json';
import en from './en.json';

const locales = { zh, en };

let currentLang = 'zh';

export function setCurrentLang(lang) {
  currentLang = lang === 'en' ? 'en' : 'zh';
}

export function getCurrentLang() {
  return currentLang;
}

function resolveValue(locale, key, params) {
  const keys = key.split('.');
  let val = locale;
  for (const k of keys) {
    if (val && typeof val === 'object' && k in val) {
      val = val[k];
    } else {
      return key;
    }
  }
  if (typeof val !== 'string') return key;
  if (params) {
    return val.replace(/\{\{(\w+)\}\}/g, (_, p) => params[p] !== undefined ? String(params[p]) : `{{${p}}}`);
  }
  return val;
}

export function st(key, params) {
  return resolveValue(locales[currentLang], key, params);
}

const I18nContext = createContext(null);

export function I18nProvider({ children }) {
  const [lang, setLang] = useState('zh');
  const [locale, setLocale] = useState(locales.zh);

  useEffect(() => {
    (async () => {
      const saved = await getSetting('language');
      if (saved === 'en' || saved === 'zh') {
        setLang(saved);
        setLocale(locales[saved]);
        setCurrentLang(saved);
      }
    })();
  }, []);

  const changeLang = useCallback(async (newLang) => {
    setLang(newLang);
    setLocale(locales[newLang]);
    setCurrentLang(newLang);
    await setSetting('language', newLang);
  }, []);

  const t = useCallback((key, params) => {
    return resolveValue(locale, key, params);
  }, [locale]);

  return (
    <I18nContext.Provider value={{ lang, setLang: changeLang, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useTranslation() {
  const ctx = useContext(I18nContext);
  if (!ctx) return { t: (k) => k, lang: 'zh', setLang: () => {} };
  return ctx;
}
