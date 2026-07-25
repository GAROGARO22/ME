export function initSettingsController({ app }) {
  if (!app.isAdmin) return;
  app.showNotification('إعدادات التطبيق قيد التطوير', 'info');
}
