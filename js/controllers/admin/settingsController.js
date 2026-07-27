export function initSettingsController({ app }) {
  if (!app.isAdmin) return;

  const container = document.getElementById('adminSettingsContent');
  if (!container) return;

  const savedSettings = JSON.parse(localStorage.getItem('meraj_admin_settings') || '{}');

  container.innerHTML = `
    <form id="adminSettingsForm">
      <div class="row g-3">
        <div class="col-md-6">
          <label class="form-label">اسم الشركة</label>
          <input class="form-control" name="companyName" value="${savedSettings.companyName || 'معراج'}">
        </div>
        <div class="col-md-6">
          <label class="form-label">العملة الافتراضية</label>
          <select class="form-select" name="defaultCurrency">
            <option value="SAR" ${savedSettings.defaultCurrency === 'SAR' ? 'selected' : ''}>ريال سعودي</option>
            <option value="USD" ${savedSettings.defaultCurrency === 'USD' ? 'selected' : ''}>دولار أمريكي</option>
            <option value="EUR" ${savedSettings.defaultCurrency === 'EUR' ? 'selected' : ''}>يورو</option>
          </select>
        </div>
        <div class="col-md-6">
          <div class="form-check mt-2">
            <input class="form-check-input" type="checkbox" id="automationEnabled" ${savedSettings.automationEnabled ? 'checked' : ''}>
            <label class="form-check-label" for="automationEnabled">تفعيل الأتمتة الذكية</label>
          </div>
        </div>
        <div class="col-md-6">
          <div class="form-check mt-2">
            <input class="form-check-input" type="checkbox" id="notificationsEnabled" ${savedSettings.notificationsEnabled ? 'checked' : ''}>
            <label class="form-check-label" for="notificationsEnabled">تفعيل الإشعارات</label>
          </div>
        </div>
      </div>
      <div class="mt-4">
        <button class="btn btn-primary" type="submit">حفظ الإعدادات</button>
      </div>
    </form>`;

  const form = document.getElementById('adminSettingsForm');
  form?.addEventListener('submit', (event) => {
    event.preventDefault();
    const payload = {
      companyName: form.companyName.value,
      defaultCurrency: form.defaultCurrency.value,
      automationEnabled: document.getElementById('automationEnabled').checked,
      notificationsEnabled: document.getElementById('notificationsEnabled').checked
    };
    localStorage.setItem('meraj_admin_settings', JSON.stringify(payload));
    app.showNotification('تم حفظ إعدادات النظام', 'success');
  });
}
