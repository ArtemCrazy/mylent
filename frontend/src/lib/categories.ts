export type CategoryDef = {
  value: string;
  label: string;
  icon: string;
  gradient: string; // tailwind "from-... to-..." part
};

const GRADIENTS = [
  "from-orange-400 to-red-500",
  "from-blue-400 to-indigo-600",
  "from-violet-400 to-purple-600",
  "from-pink-400 to-rose-600",
  "from-green-400 to-emerald-600",
  "from-yellow-400 to-amber-500",
  "from-indigo-400 to-blue-700",
  "from-emerald-400 to-teal-600",
  "from-slate-400 to-slate-600",
  "from-cyan-400 to-sky-600",
  "from-lime-400 to-emerald-600",
  "from-fuchsia-400 to-purple-700",
] as const;

function g(i: number) {
  return GRADIENTS[i % GRADIENTS.length];
}

/**
 * Справочник категорий.
 * `value` используется как ключ в БД и для фильтрации в ленте.
 */
export const CATEGORY_DEFS = [
  // Базовые (старые) категории, чтобы не ломать уже существующие источники в БД
  { value: "news", label: "Новости", icon: "📰", gradient: g(0) },
  { value: "tech", label: "Технологии", icon: "💻", gradient: g(1) },
  { value: "ai", label: "ИИ", icon: "🤖", gradient: g(2) },
  { value: "web_studio", label: "Веб-студия", icon: "🎨", gradient: g(3) },
  { value: "sport", label: "Спорт", icon: "⚽", gradient: g(4) },
  { value: "humor", label: "Юмор", icon: "😄", gradient: g(5) },
  { value: "space", label: "Космос", icon: "🚀", gradient: g(6) },
  { value: "investments", label: "Инвестиции", icon: "📈", gradient: g(7) },
  { value: "other", label: "Другое", icon: "📌", gradient: g(8) },

  // Категории со скриншота (и их иконки)
  { value: "marketing_pr_reklama", label: "Маркетинг PR, реклама", icon: "📣", gradient: g(9) },
  { value: "psihologiya", label: "Психология", icon: "🧠", gradient: g(10) },
  { value: "dizajn", label: "Дизайн", icon: "🎨", gradient: g(11) },
  { value: "politika", label: "Политика", icon: "🏛️", gradient: g(12) },
  { value: "iskusstvo", label: "Искусство", icon: "🖼️", gradient: g(13) },
  { value: "pravo", label: "Право", icon: "⚖️", gradient: g(14) },
  { value: "obrazovanie", label: "Образование", icon: "📚", gradient: g(15) },
  { value: "knigi", label: "Книги", icon: "📖", gradient: g(16) },

  { value: "lingvistika", label: "Лингвистика", icon: "🗣️", gradient: g(17) },
  { value: "karera", label: "Карьера", icon: "💼", gradient: g(18) },
  { value: "poznavatelnoe", label: "Познавательное", icon: "🧭", gradient: g(19) },
  { value: "kultura", label: "Культура", icon: "🎭", gradient: g(20) },
  { value: "moda_i_krasota", label: "Мода и красота", icon: "💄", gradient: g(21) },
  { value: "medicina", label: "Медицина", icon: "🩺", gradient: g(22) },
  { value: "zdorove_i_fitnes", label: "Здоровье и фитнес", icon: "🏃", gradient: g(23) },

  { value: "kartinki_i_foto", label: "Картинки и фото", icon: "🖼️", gradient: g(24) },
  { value: "soft_i_prilozheniya", label: "Софт и приложения", icon: "🧩", gradient: g(25) },
  { value: "video_i_filmy", label: "Видео и фильмы", icon: "🎬", gradient: g(26) },
  { value: "muzyka", label: "Музыка", icon: "🎵", gradient: g(27) },
  { value: "igry", label: "Игры", icon: "🎮", gradient: g(28) },
  { value: "eda_i_kulinariya", label: "Еда и кулинария", icon: "🍲", gradient: g(29) },
  { value: "citati", label: "Цитаты", icon: "💬", gradient: g(30) },
  { value: "rukodelie", label: "Рукоделие", icon: "🧵", gradient: g(31) },

  { value: "semya_i_deti", label: "Семья и дети", icon: "👨‍👩‍👧‍👦", gradient: g(32) },
  { value: "priroda", label: "Природа", icon: "🌿", gradient: g(33) },
  { value: "interer_i_stroitelstvo", label: "Интерьер и строительство", icon: "🏗️", gradient: g(34) },
  { value: "telegram", label: "Телеграм", icon: "📨", gradient: g(35) },
  { value: "instagram", label: "Инстаграм", icon: "📸", gradient: g(36) },
  { value: "prodazhi", label: "Продажи", icon: "💰", gradient: g(37) },
  { value: "transport", label: "Транспорт", icon: "🚆", gradient: g(38) },
  { value: "religiya", label: "Религия", icon: "🕍", gradient: g(39) },

  // Нижняя строка (снимок 2)
  { value: "ezoterika", label: "Эзотерика", icon: "🔮", gradient: g(40) },
  { value: "darknet", label: "Даркнет", icon: "🕸️", gradient: g(41) },
  { value: "bukmekterstvo", label: "Букмекерство", icon: "🎲", gradient: g(42) },
  { value: "shok_kontent", label: "Шок-контент", icon: "⚡", gradient: g(43) },
  { value: "erotika", label: "Эротика", icon: "🔥", gradient: g(44) },
  { value: "dlya_vzroslyh", label: "Для взрослых", icon: "🔞", gradient: g(45) },
];

export function getCategoryDef(value: string | null | undefined): CategoryDef | null {
  if (!value) return null;
  const byValue = CATEGORY_DEFS.find((d) => d.value === value);
  if (byValue) return byValue;
  // Если в БД лежит "как текст" (label), попробуем отыскать по label
  const byLabel = CATEGORY_DEFS.find((d) => d.label === value);
  return byLabel ?? null;
}

export const CATEGORY_ORDER = CATEGORY_DEFS.map((c) => c.value);

