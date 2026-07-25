export function initOperationsController({ app }) {
  if (!app.isAdmin) return;
  app.showNotification('سجل العمليات قيد التطوير', 'info');
}
