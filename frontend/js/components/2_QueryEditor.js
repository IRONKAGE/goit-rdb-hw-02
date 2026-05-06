import { writeLog } from './5_ConsoleLogger.js';
import config from '../config.js';
import uk from '../locales/uk.js';
import en from '../locales/en.js';

const translations = { uk, en };
let currentLang = localStorage.getItem('ide_lang') || 'uk';

export function initQueryEditor(containerId) {
  const container = document.getElementById(containerId);
  const t = translations[currentLang];

  // 1. Визначаємо комбінацію клавіш раз і назавжди
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0 || navigator.userAgent.includes('Mac');
  const execShortcut = isMac ? '⌘+Enter' : 'Ctrl+Enter';

  container.innerHTML = `
        <div class="panel-header flex justify-between items-center relative z-50">
            <span>Input Script</span>
            <div class="flex items-center gap-2">
                <!-- Кнопка очищення (Просто піктограма, як перемикач мови) -->
                <button id="btn-clear-editor" class="text-lg hover:scale-110 transition-transform drop-shadow-md cursor-pointer" title="${t.qe_clear}">
                    🧹
                </button>

                <div class="group relative flex items-center gap-1 cursor-help border-x border-[var(--border)] px-3 mx-1">
                    <input type="checkbox" id="god-mode-check" class="scale-90 cursor-pointer accent-red-500">
                    <span id="label-god-mode" class="text-[9px] font-bold text-red-500">${t.qe_god_mode}</span>
                    <div id="tooltip-god-mode" class="absolute top-full right-0 mt-2 w-48 p-2 bg-[var(--panel)] border border-red-500 text-[var(--text)] text-[10px] rounded shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-[100] pointer-events-none text-center leading-tight">
                        ${t.qe_god_mode_tip}
                    </div>
                </div>

                <!-- Кнопка копіювання (Просто піктограма) -->
                <button id="btn-copy-sql" class="text-lg hover:scale-110 transition-transform drop-shadow-md cursor-pointer pr-1" title="${t.qe_copy}">
                    📋
                </button>

                <button id="btn-import-sql" class="btn-base text-[9px] uppercase font-bold px-3 transition-colors border-l border-[var(--border)]">
                    ${t.qe_import}
                </button>
                <button id="btn-export-sql" class="btn-base text-[9px] uppercase font-bold px-3 transition-colors">
                    ${t.qe_export}
                </button>

                <div class="pl-2 border-l border-[var(--border)] flex gap-2">
                    <button id="btn-format-sql" class="btn-base text-[9px] px-3 uppercase transition-all border border-[var(--border)] hover:bg-[var(--border)]/30 font-bold" title="${t.qe_format}">
                        ✨ ${t.qe_format}
                    </button>
                    <button id="btn-execute" title="${t.qe_execute} (${execShortcut})" class="btn-base text-[10px] px-4 uppercase font-bold transition-all text-[var(--text)] hover:text-[var(--accent)] shadow-[0_0_8px_var(--accent)] hover:bg-[var(--border)]/30">
                        ${t.qe_execute}
                    </button>
                </div>
            </div>
        </div>
        <div id="editor-wrapper" class="flex-grow min-h-0 bg-black/20"></div>
    `;

  // --- АВТОЗАПОВНЕННЯ (СЛОВНИКИ) ---
  let currentDictionary = [];

  async function loadDbDictionary(db_id) {
    let engine = 'sql';
    if (db_id) {
      const parts = db_id.split('_');
      if (parts.length > 1) engine = parts[1];
    }

    try {
      const r = await fetch(`./dicts/${engine}.json`);
      if (r.ok) currentDictionary = await r.json();
    } catch (e) {
      currentDictionary = ["SELECT", "FROM", "WHERE", "INSERT", "UPDATE", "DELETE"];
    }
  }

  const savedDb = localStorage.getItem('ide_target_db');
  loadDbDictionary(savedDb);

  document.addEventListener('db-changed', (e) => {
    loadDbDictionary(e.detail.id);
  });

  function customSqlHint(cm) {
    const cursor = cm.getCursor();
    const token = cm.getTokenAt(cursor);
    const word = token.string;

    if (!/^\w+$/.test(word)) return null;

    const list = currentDictionary.filter(item =>
      item.toLowerCase().startsWith(word.toLowerCase())
    );

    if (list.length === 0) return null;

    return {
      list: list,
      from: CodeMirror.Pos(cursor.line, token.start),
      to: CodeMirror.Pos(cursor.line, token.end)
    };
  }

  // --- ІНІЦІАЛІЗАЦІЯ РЕДАКТОРА ---
  const savedDraft = localStorage.getItem('ide_query_draft');
  const editor = CodeMirror(document.getElementById('editor-wrapper'), {
    value: (savedDraft && savedDraft.trim() !== '') ? savedDraft : "-- ⏳ Завантаження базового скрипта...\n",
    mode: "sql",
    lineNumbers: true,
    lineWrapping: true,
    theme: "default",
    extraKeys: {
      "Ctrl-Enter": executeSQL,
      "Cmd-Enter": executeSQL,
      "Tab": function (cm) {
        const cursor = cm.getCursor();
        const token = cm.getTokenAt(cursor);

        if (token.string && /^\w+$/.test(token.string)) {
          cm.showHint({ hint: customSqlHint, completeSingle: true });
        } else {
          cm.execCommand("defaultTab");
        }
      }
    }
  });

  if (!savedDraft || savedDraft.trim() === '') {
    if (config.IS_STANDALONE && window.INJECTED_INIT_SQL) {
      // Якщо ми в Standalone режимі (скрипт збілдив builder.py)
      editor.setValue(window.INJECTED_INIT_SQL);
      editor.clearHistory();
    } else {
      // Старий добрий fetch для локального режиму розробки
      fetch('./sql/default.sql')
        .then(r => r.ok ? r.text() : Promise.reject())
        .then(text => { editor.setValue(text); editor.clearHistory(); })
        .catch(() => editor.setValue("-- Помилка: default.sql відсутній\nSELECT * FROM sys_users;"));
    }
  }

  setTimeout(() => document.dispatchEvent(new CustomEvent('code-changed', { detail: editor.getValue() })), 100);

  const elements = {
    btnClear: document.getElementById('btn-clear-editor'),
    btnCopy: document.getElementById('btn-copy-sql'),
    btnImport: document.getElementById('btn-import-sql'),
    btnExport: document.getElementById('btn-export-sql'),
    btnExecute: document.getElementById('btn-execute'),
    btnFormat: document.getElementById('btn-format-sql'),
    lblGodMode: document.getElementById('label-god-mode'),
    tipGodMode: document.getElementById('tooltip-god-mode'),
    checkGodMode: document.getElementById('god-mode-check')
  };

  const updateTexts = () => {
    const loc = translations[currentLang];
    elements.btnClear.title = loc.qe_clear;
    elements.btnCopy.title = loc.qe_copy;
    elements.btnFormat.title = loc.qe_format;
    elements.btnFormat.innerHTML = `✨ ${loc.qe_format}`;
    elements.btnImport.innerText = loc.qe_import;
    elements.btnExport.innerText = loc.qe_export;

    if (!elements.btnExecute.disabled) {
      elements.btnExecute.innerText = loc.qe_execute;
    }
    elements.btnExecute.title = `${loc.qe_execute} (${execShortcut})`;

    elements.lblGodMode.innerText = loc.qe_god_mode;
    elements.tipGodMode.innerText = loc.qe_god_mode_tip;
  };

  document.addEventListener('lang-changed', (e) => { currentLang = e.detail; updateTexts(); });

  editor.on('change', () => {
    const currentVal = editor.getValue();
    localStorage.setItem('ide_query_draft', currentVal);
    document.dispatchEvent(new CustomEvent('code-changed', { detail: currentVal }));
  });

  // 🧹 Очищення
  elements.btnClear.addEventListener('click', () => {
    editor.setValue('');
    writeLog(translations[currentLang].log_cleared, "text-[var(--log-text)] italic opacity-70");
  });

  // 📋 Копіювати код
  elements.btnCopy.addEventListener('click', () => {
    const sql = editor.getValue().trim();
    if (!sql) return;
    navigator.clipboard.writeText(sql);
    writeLog(translations[currentLang].log_copied, "text-[var(--accent)] italic");
  });

  // ✨ Форматувати код
  elements.btnFormat.addEventListener('click', () => {
    let sql = editor.getValue();
    if (!sql.trim()) return;

    const db_id = document.getElementById('db-select')?.value || localStorage.getItem('ide_target_db');
    let engine = 'sql';

    const dialectMap = {
      'mysql': 'mysql',
      'postgres': 'postgresql',
      'mssql': 'tsql',
      'oracle': 'plsql'
    };

    if (db_id) {
      const parts = db_id.split('_');
      if (parts.length > 1 && dialectMap[parts[1]]) {
        engine = parts[1];
      }
    }

    try {
      const formattedSql = window.sqlFormatter.format(sql, {
        language: dialectMap[engine] || 'sql',
        keywordCase: 'upper',
        linesBetweenQueries: 1,
      });

      const finalSql = formattedSql.replace(/--\s*STAND_META_ENGINE:/gi, '-- STAND_META_ENGINE:');

      editor.setValue(finalSql);
      writeLog(`${translations[currentLang].log_formatted}${engine.toUpperCase()}]`, "text-[var(--accent)] italic");
    } catch (error) {
      writeLog(`> Помилка форматування: перевірте синтаксис SQL`, "text-red-500 font-bold");
    }
  });

  // --- ІМПОРТ ---
  elements.btnImport.addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.sql,.txt,.psql,.tsql,.plsql,.prc';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (r) => {
        editor.setValue(r.target.result);
        writeLog(`${translations[currentLang].log_imported}${file.name}`, "text-[var(--accent)] font-bold");
      };
      reader.readAsText(file);
    };
    input.click();
  });

  // --- ЕКСПОРТ ---
  elements.btnExport.addEventListener('click', async () => {
    const sql = editor.getValue().trim();
    const loc = translations[currentLang];
    if (!sql) return writeLog(loc.qe_empty, "text-yellow-500 font-bold");

    const db_id = document.getElementById('db-select')?.value || localStorage.getItem('ide_target_db');
    let engine = 'unknown';
    if (db_id) {
      const parts = db_id.split('_');
      if (parts.length > 1) engine = parts[1];
    }

    let defaultExt = 'sql';
    if (engine === 'mssql') defaultExt = 'tsql';
    else if (engine === 'postgres') defaultExt = 'psql';
    else if (engine === 'oracle') {
      if (/CREATE\s+(OR\s+REPLACE\s+)?PROCEDURE/i.test(sql)) defaultExt = 'prc';
      else defaultExt = 'plsql';
    }

    const defaultFileName = `query_${engine}_${new Date().getTime()}`;

    try {
      if ('showSaveFilePicker' in window) {
        const handle = await window.showSaveFilePicker({
          suggestedName: `${defaultFileName}.${defaultExt}`,
          types: [
            { description: 'Універсальний SQL (.sql)', accept: { 'application/sql': ['.sql'] } },
            { description: 'PostgreSQL Script (.psql)', accept: { 'application/x-sql': ['.psql'] } },
            { description: 'T-SQL Script (.tsql)', accept: { 'application/x-tsql': ['.tsql'] } },
            { description: 'Oracle PL/SQL (.plsql)', accept: { 'application/x-plsql': ['.plsql'] } },
            { description: 'Oracle Procedure (.prc)', accept: { 'application/x-prc': ['.prc'] } },
            { description: 'Звичайний текст (.txt)', accept: { 'text/plain': ['.txt'] } }
          ],
        });
        const writable = await handle.createWritable();
        await writable.write(sql);
        await writable.close();
        writeLog(loc.log_exported, "text-[var(--accent)] font-bold");
      } else {
        const blob = new Blob([sql], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${defaultFileName}.${defaultExt}`;
        a.click();
        URL.revokeObjectURL(url);
        writeLog(`${loc.log_exported_ext}.${defaultExt}`, "text-[var(--accent)] font-bold");
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        writeLog(`${loc.log_export_fail}${err.message}`, "text-red-500 font-bold");
      }
    }
  });

  // --- ВИКОНАННЯ SQL ---
  elements.btnExecute.addEventListener('click', executeSQL);

  async function executeSQL() {
    const loc = translations[currentLang];
    let sql = editor.getValue().trim();
    const db_id = document.getElementById('db-select')?.value || localStorage.getItem('ide_target_db');
    const isGodMode = elements.checkGodMode.checked;

    if (!sql) return writeLog(loc.qe_empty, "text-yellow-500 font-bold");
    if (!db_id) return writeLog(loc.qe_no_db, "text-red-500 font-bold");

    // ⚡ МАГІЯ РЕЖИМУ БОГА
    if (isGodMode) {
      const engine = db_id.split('_')[1] || 'sql';

      if (engine !== 'oracle') {
        const originalSql = sql;
        sql = sql.replace(/CREATE\s+TABLE\s+(?!IF\s+NOT\s+EXISTS\b)([a-zA-Z0-9_]+)/gi,
          (match, tableName) => `DROP TABLE IF EXISTS ${tableName};\n${match}`
        );

        if (originalSql !== sql) {
          writeLog("> [GOD MODE] Автоматично застосовано DROP TABLE для існуючих об'єктів.", "text-[var(--accent)] italic opacity-70");
        }
      }
    }

    elements.btnExecute.disabled = true;
    elements.btnExecute.innerText = loc.qe_executing;
    gsap.to("#anim-overlay", { opacity: 0.15, duration: 0.1, yoyo: true, repeat: 1 });

    writeLog(`> ${loc.qe_execute} ${isGodMode ? '[GOD MODE]' : ''}...`, "text-[var(--text)]");

    try {
      const r = await fetch(`${config.API_URL}/execute`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql, db_id, god_mode: isGodMode })
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.detail || "Server Error");

      document.dispatchEvent(new CustomEvent('data-ready', { detail: data }));
      writeLog(`> ${loc.qe_success} ${data.rows ? data.rows.length : 0}`, "text-[var(--accent)] font-bold");
    } catch (e) {
      let errorMsg = e.message || "Unknown Server Error";

      if (errorMsg.includes('[SQL:')) {
        errorMsg = errorMsg.split('[SQL:')[0];
      }
      if (errorMsg.includes('(Background on this error')) {
        errorMsg = errorMsg.split('(Background on this error')[0];
      }

      errorMsg = errorMsg.replace(/\([\w\.]+\.(\w+Error)\)/, '[$1]');
      writeLog(`${loc.qe_error} ${errorMsg.trim()}`, "text-red-500 font-bold");
    } finally {
      elements.btnExecute.disabled = false;
      elements.btnExecute.innerText = loc.qe_execute;
    }
  }
}
