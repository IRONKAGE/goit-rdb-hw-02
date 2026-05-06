import { writeLog } from './5_ConsoleLogger.js';
import uk from '../locales/uk.js';
import en from '../locales/en.js';

const translations = { uk, en };

// Зчитуємо ВСІ налаштування з пам'яті
let currentLang = localStorage.getItem('ide_lang') || 'uk';
let currentTheme = localStorage.getItem('ide_theme') || 'dracula';
let selectedDbId = localStorage.getItem('ide_target_db') || ''; // 💡 Пам'ятаємо обрану базу!
let activeDbs = {};

export function initWorkspaceHeader(containerId, config) {
  const container = document.getElementById(containerId);

  // Одразу фіксуємо тему, щоб не було білих спалахів
  if (currentTheme === 'alucard') {
    document.body.classList.add('theme-alucard');
    document.body.classList.remove('theme-dracula');
  }

  const t = translations[currentLang];
  const isAlucard = currentTheme === 'alucard';
  const langTitle = currentLang === 'uk' ? 'Змінити мову / Change Language' : 'Change Language / Змінити мову';

  // Вставляємо HTML з УЖЕ готовими текстами (це прибирає глюк з затримкою рендеру)
  container.innerHTML = `
        <div class="flex items-center gap-3 w-1/3">
            <div class="w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse shadow-[0_0_8px_var(--accent)]"></div>
            <span class="font-bold tracking-widest text-[var(--accent)] text-xs">DevOpsML SQL Lab<br/>by IRONKAGE</span>
            <select id="db-select" class="input-style text-[13px] w-70 font-bold text-[var(--accent)]">
                <option value="">⏳ Очікування...</option>
            </select>
        </div>
        <div class="w-1/3 text-center">
            <span id="project-title" class="font-black tracking-[0.2em] text-[var(--text)] opacity-80 uppercase text-s">
                ${t.project}: ${config.PROJECT_NAME}
            </span>
        </div>
        <div class="w-1/3 flex justify-end items-center gap-4">
            <button id="theme-toggle" class="btn-base text-[13px] uppercase font-bold transition-colors">
                ${isAlucard ? t.theme_alucard : t.theme_dracula}
            </button>
            <button id="lang-toggle" class="text-xl hover:scale-110 transition-transform drop-shadow-md cursor-pointer" title="${langTitle}">
                ${currentLang === 'uk' ? '🇺🇦' : '🇬🇧'}
            </button>
        </div>
    `;

  const elements = {
    dbSelect: document.getElementById('db-select'),
    projectTitle: document.getElementById('project-title'),
    themeToggle: document.getElementById('theme-toggle'),
    langToggle: document.getElementById('lang-toggle')
  };

  const updateTexts = () => {
    const loc = translations[currentLang];
    elements.projectTitle.innerText = `${loc.project}: ${config.PROJECT_NAME}`;
    elements.themeToggle.innerText = currentTheme === 'alucard' ? loc.theme_alucard : loc.theme_dracula;
    elements.langToggle.innerText = currentLang === 'uk' ? '🇺🇦' : '🇬🇧';
    elements.langToggle.title = currentLang === 'uk' ? 'Змінити мову / Change Language' : 'Change Language / Змінити мову';
    updateDbList();
  };

  const updateDbList = () => {
    const loc = translations[currentLang];
    let dbOptions = `<option value="">${loc.no_db}</option>`;

    if (Object.keys(activeDbs).length > 0) {
      // 💡 ВИПРАВЛЕНО: тут тепер =, а не +=
      dbOptions = Object.keys(activeDbs)
        .map(id => `<option value="${id}" ${id === selectedDbId ? 'selected' : ''}>${id.toUpperCase()}</option>`)
        .join('');
    }

    elements.dbSelect.innerHTML = dbOptions;
  };

  // --- СЛУХАЧІ ПОДІЙ (Ініціалізуються один раз) ---

  elements.themeToggle.addEventListener('click', () => {
    const isAlucardNow = document.body.classList.toggle('theme-alucard');
    document.body.classList.toggle('theme-dracula', !isAlucardNow);

    currentTheme = isAlucardNow ? 'alucard' : 'dracula';
    localStorage.setItem('ide_theme', currentTheme);

    updateTexts();
    writeLog(`${translations[currentLang].theme_changed} ${isAlucardNow ? translations[currentLang].theme_light : translations[currentLang].theme_dark}`, "text-[var(--accent)] font-bold");
    document.dispatchEvent(new CustomEvent('theme-changed', { detail: currentTheme }));
  });

  elements.langToggle.addEventListener('click', () => {
    currentLang = currentLang === 'uk' ? 'en' : 'uk';
    localStorage.setItem('ide_lang', currentLang);

    updateTexts();
    writeLog(translations[currentLang].lang_changed, "text-[var(--accent)] font-bold");
    document.dispatchEvent(new CustomEvent('lang-changed', { detail: currentLang }));
  });

  elements.dbSelect.addEventListener('change', (e) => {
    selectedDbId = e.target.value;
    localStorage.setItem('ide_target_db', selectedDbId); // 💡 Зберігаємо вибір

    const dbType = selectedDbId ? activeDbs[selectedDbId].engine : 'none';
    if (selectedDbId) {
      writeLog(`> Target DB set: ${selectedDbId} [${dbType}]`, "text-[var(--accent)] font-bold");
    } else {
      writeLog(`> Target DB disconnected.`, "text-red-400 font-bold");
    }

    document.dispatchEvent(new CustomEvent('db-selected', { detail: selectedDbId }));
  });

  // --- РЕАКЦІЯ НА ДАНІ З БЕКЕНДУ ---
  document.addEventListener('dbs-loaded', (e) => {
    activeDbs = e.detail;

    // Якщо раніше збережена база видалена — скидаємо вибір
    if (selectedDbId && !activeDbs[selectedDbId]) {
      selectedDbId = '';
      localStorage.removeItem('ide_target_db');
    }

    // Якщо бази завантажилися, але нічого не вибрано (перший запуск) — автовибір першої
    if (!selectedDbId && Object.keys(activeDbs).length > 0) {
      selectedDbId = Object.keys(activeDbs)[0];
      localStorage.setItem('ide_target_db', selectedDbId);
    }

    updateDbList();

    // Одразу кажемо системі (і Snippet Engine), яка база зараз активна
    document.dispatchEvent(new CustomEvent('db-selected', { detail: selectedDbId }));
  });
}
