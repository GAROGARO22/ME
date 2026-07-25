export function initSubscriptionsController({ app }) {
  if (!app.isAdmin) return;
  app.showNotification('إدارة الاشتراكات قيد التطوير', 'info');
}
