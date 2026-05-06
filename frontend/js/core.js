import config from './config.js';
import { initLogger, writeLog } from './components/5_ConsoleLogger.js';
import { initWorkspaceHeader } from './components/1_WorkspaceHeader.js';
import { initQueryEditor } from './components/2_QueryEditor.js';
import { initDataGrid } from './components/3_DataGrid.js';
import { initSchemaInspector } from './components/4_SchemaInspector.js';
import { initSnippetEngine } from './components/6_SnippetEngine.js';

// Top-level await: чекаємо готовності DOM
await new Promise(resolve => {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', resolve);
  else resolve();
});

// 1. Ініціалізуємо логер першим, щоб бачити процес завантаження
initLogger('console-logger');
writeLog(`Система ініціалізована. Project: ${config.PROJECT_NAME}`, "text-emerald-500");

// 2. Ініціалізуємо всі компоненти
initWorkspaceHeader('workspace-header', config);
initQueryEditor('query-editor');
initDataGrid('data-grid');
initSchemaInspector('schema-inspector');
initSnippetEngine('snippet-engine');

// 3. Синхронізуємо бази даних з бекендом
try {
  const res = await fetch(`${config.API_URL}/databases`);
  if (!res.ok) throw new Error("API не відповідає");
  const dbs = await res.json();

  // Сповіщаємо всі компоненти про нові бази даних
  document.dispatchEvent(new CustomEvent('dbs-loaded', { detail: dbs }));
  writeLog("Синхронізація баз даних успішна.", "text-blue-400");
} catch (e) {
  writeLog("API недоступне. Перевірте Docker Compose.", "text-red-500 font-bold");
}
