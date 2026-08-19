import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type Lang = "en" | "ru";

export const LANGUAGES: { code: Lang; label: string; short: string }[] = [
  { code: "en", label: "English", short: "EN" },
  { code: "ru", label: "Русский", short: "RU" },
];

const STORAGE_KEY = "loqal.lang.v1";

/**
 * Keys are the English source strings, so untranslated copy simply falls back
 * to English instead of rendering a raw token.
 */
const RU: Record<string, string> = {
  // Header
  Home: "Главная",
  Properties: "Объекты",
  Services: "Услуги",
  "My Portfolio": "Мой портфель",
  Other: "Прочее",
  "All Services": "Все услуги",
  Maintenance: "Обслуживание",
  Cleaning: "Уборка",
  Security: "Безопасность",
  Landscaping: "Благоустройство",
  "Financial Services": "Финансовые услуги",
  "Tenant Management": "Управление арендаторами",
  "Service Requests": "Заявки на услуги",
  "My Properties": "Мои объекты",
  "My Profile": "Мой профиль",
  "My profile": "Мой профиль",
  "My Services": "Мои услуги",
  "My Financials": "Мои финансы",
  Analytics: "Аналитика",
  Documents: "Документы",
  "Help & Support": "Помощь и поддержка",
  Documentation: "Документация",
  Notifications: "Уведомления",
  "Resources & Academy": "Ресурсы и академия",
  Community: "Сообщество",
  Feedback: "Обратная связь",
  "Log in": "Войти",
  Account: "Аккаунт",
  "My workspace": "Мое рабочее пространство",
  "Sign out": "Выйти",
  "Search...": "Поиск...",
  Search: "Поиск",
  Help: "Помощь",
  Settings: "Настройки",
  Language: "Язык",
  "📖 Help Center": "📖 Центр помощи",
  "☎️ Contact Us": "☎️ Связаться с нами",
  "❔ FAQ": "❔ Частые вопросы",
  "💬 Send us Feedback": "💬 Оставить отзыв",
  Client: "Клиент",
  "Corporate client": "Корпоративный клиент",
  Partner: "Партнер",
  Admin: "Администратор",

  // Landing
  "White-glove concierge for real estate": "Консьерж-сервис премиум-класса для недвижимости",
  "Own property anywhere. Run everything from one place.":
    "Владейте недвижимостью где угодно. Управляйте всем из одного места.",
  "Loqal connects entity formation, banking, mortgage, inspections, management, legal and utilities into a single operating layer for investors and owners.":
    "Loqal объединяет регистрацию компаний, банковские услуги, ипотеку, инспекции, управление, юридическое сопровождение и коммунальные услуги в единую платформу для инвесторов и владельцев.",
  "Become a Loqal": "Стать клиентом Loqal",
  "Browse properties": "Смотреть объекты",
  "Client access": "Доступ для клиентов",
  "Individual owners and investors managing a portfolio remotely. Create your profile in a minute and start onboarding properties and services.":
    "Частные владельцы и инвесторы, управляющие портфелем удаленно. Создайте профиль за минуту и начните подключать объекты и услуги.",
  "Partner & corporate access": "Доступ для партнеров и компаний",
  "Realtors, mortgage lenders, cleaning crews, other service providers and company-held portfolios are onboarded by our team. Send us your company details and we will set up your workspace.":
    "Риелторов, ипотечных кредиторов, клининговые компании, других поставщиков услуг и корпоративные портфели подключает наша команда. Отправьте данные компании, и мы настроим рабочее пространство.",
  "Request access": "Запросить доступ",
  "Entity & banking": "Компания и банк",
  "LLC formation, EIN, US bank accounts and compliance handled end to end.":
    "Регистрация LLC, EIN, счета в банках США и комплаенс — под ключ.",
  "Acquisition & mortgage": "Покупка и ипотека",
  "Marketplace listings, inspections, valuations and lender introductions.":
    "Объекты на маркетплейсе, инспекции, оценка и подбор кредиторов.",
  Operations: "Операционное управление",
  "Property management, cleaning, maintenance, utilities, legal and reporting.":
    "Управление объектами, уборка, обслуживание, коммунальные услуги, юристы и отчетность.",

  // Dashboard
  "Welcome back": "С возвращением",
  "Here's what's happening with your properties today":
    "Вот что происходит с вашими объектами сегодня",
  "Search properties": "Поиск объектов",
  "Search for a property, address, city, or ID…":
    "Найдите объект, адрес, город или ID…",
  "Start typing or": "Начните вводить или",
  "open full search": "откройте расширенный поиск",
  "Total Properties": "Всего объектов",
  "Monthly Revenue": "Доход за месяц",
  "Pending Services": "Услуги в ожидании",
  "Active Tenants": "Активные арендаторы",
  "↑ 2 active listings": "↑ 2 активных объявления",
  "↑ 12% vs last month": "↑ 12% к прошлому месяцу",
  "3 require attention": "3 требуют внимания",
  "↑ 1 new tenant": "↑ 1 новый арендатор",
  "Your Recent Properties": "Ваши последние объекты",
  "View all →": "Смотреть все →",
  "Manage →": "Управлять →",
  "View financials →": "Смотреть финансы →",
  "Active Services": "Активные услуги",
  "Upcoming & Due Payments": "Предстоящие платежи",
  "Saved Properties": "Сохраненные объекты",
  "Recent Activity & Updates": "Последняя активность и обновления",
  "★ Saved": "★ Сохранено",
  "Luxury Apartment - Downtown": "Люксовая квартира — центр",
  "Modern Office Space": "Современный офис",
  "Berlin, Germany": "Берлин, Германия",
  "Madrid, Spain": "Мадрид, Испания",
  "● Active": "● Активен",
  "● Pending review": "● На проверке",
  "Monthly Maintenance": "Ежемесячное обслуживание",
  "Berlin Downtown Apartment": "Квартира в центре Берлина",
  "Last updated: Today": "Обновлено: сегодня",
  "Weekly Cleaning": "Еженедельная уборка",
  "Office Space Madrid": "Офис в Мадриде",
  "Last updated: 2 days ago": "Обновлено: 2 дня назад",
  "Security Monitoring": "Мониторинг безопасности",
  "3 properties under 24/7 monitoring": "3 объекта под наблюдением 24/7",
  Active: "Активно",
  "Rent - Berlin Downtown": "Аренда — центр Берлина",
  "Service Invoice - Cleaning": "Счет за услугу — уборка",
  "Mortgage Instalment": "Платеж по ипотеке",
  "Due: Today": "Срок: сегодня",
  "Due: 2 days ago": "Срок: 2 дня назад",
  "Due in 6 days": "Срок: через 6 дней",
  "Due today": "Сегодня",
  Overdue: "Просрочено",
  Upcoming: "Предстоит",
  "Seaside Villa": "Вилла у моря",
  "Boutique Hotel Concept": "Концепция бутик-отеля",
  "Historic Mansion": "Историческая усадьба",
  "New Service Request Received": "Получена новая заявка на услугу",
  "Maintenance request for Berlin Downtown Apartment has been received and assigned to contractor":
    "Заявка на обслуживание квартиры в центре Берлина получена и назначена подрядчику",
  "Service Completed": "Услуга выполнена",
  "Cleaning service completed at Madrid Office Space":
    "Уборка в офисе в Мадриде выполнена",
  "Payment Received": "Платеж получен",
  "Monthly rent payment from 3 tenants has been processed":
    "Ежемесячная арендная плата от 3 арендаторов обработана",
  "Document Uploaded": "Документ загружен",
  "Lease agreement for new tenant has been uploaded to documents":
    "Договор аренды нового арендатора загружен в документы",
  "2 hours ago": "2 часа назад",
  "5 hours ago": "5 часов назад",
  "1 day ago": "1 день назад",
  "3 days ago": "3 дня назад",
};

const DICTS: Record<Lang, Record<string, string>> = { en: {}, ru: RU };

type I18nValue = {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: string) => string;
};

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved === "en" || saved === "ru") setLangState(saved);
    } catch {
      /* storage unavailable */
    }
  }, []);

  useEffect(() => {
    if (typeof document !== "undefined") document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* storage unavailable */
    }
  }, []);

  const value = useMemo<I18nValue>(
    () => ({
      lang,
      setLang,
      t: (key: string) => DICTS[lang][key] ?? key,
    }),
    [lang, setLang],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside <I18nProvider>");
  return ctx;
}

/** Convenience hook for components that only need the translate function. */
export function useT() {
  return useI18n().t;
}
