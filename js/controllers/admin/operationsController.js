export async function initOperationsController({ app }) {
  if (!app.isAdmin) return;

  const container = document.getElementById('adminOperationsContent');
  if (!container) return;

  try {
    const snapshot = await app.db.collection('operationsLog').get();
    const operations = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    const fallback = JSON.parse(localStorage.getItem('meraj_admin_operations') || '[]');
    const items = operations.length ? operations : fallback;

    if (!items.length) {
      container.innerHTML = `
        <div class="alert alert-info mb-0">
          لا توجد عمليات مسجلة بعد. سيتم عرض السجل هنا عند إضافة العمليات أو عند تفعيل الأتمتة.
        </div>`;
      return;
    }

    container.innerHTML = `
      <div class="list-group">
        ${items.slice(0, 10).map((item) => `
          <div class="list-group-item">
            <div class="d-flex justify-content-between align-items-start">
              <div>
                <h6 class="mb-1">${item.title || 'عملية جديدة'}</h6>
                <p class="mb-1 text-muted">${item.detail || 'تم تسجيل العملية بنجاح.'}</p>
              </div>
              <small class="text-muted">${item.createdAt || item.time || 'الآن'}</small>
            </div>
          </div>
        `).join('')}
      </div>`;
  } catch (error) {
    console.error('Operations controller error:', error);
    container.innerHTML = '<div class="alert alert-danger mb-0">تعذر تحميل سجل العمليات.</div>';
  }
}
