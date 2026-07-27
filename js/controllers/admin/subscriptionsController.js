export async function initSubscriptionsController({ app }) {
  if (!app.isAdmin) return;

  const container = document.getElementById('adminSubscriptionsContent');
  if (!container) return;

  try {
    const snapshot = await app.db.collection('subscriptions').get();
    const subscriptions = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    if (!subscriptions.length) {
      container.innerHTML = `
        <div class="alert alert-info mb-0">
          لا توجد اشتراكات مسجلة بعد. يمكن للمدير إضافة خطط الاشتراك لاحقًا من هذا القسم.
        </div>`;
      return;
    }

    container.innerHTML = `
      <div class="table-responsive">
        <table class="table table-hover align-middle">
          <thead>
            <tr>
              <th>اسم الاشتراك</th>
              <th>الوصف</th>
              <th>السعر</th>
              <th>الحالة</th>
            </tr>
          </thead>
          <tbody>
            ${subscriptions.map((item) => `
              <tr>
                <td>${item.name || '-'}</td>
                <td>${item.description || 'لا يوجد وصف'}</td>
                <td>${item.price || 0} ر.س</td>
                <td><span class="badge ${item.isActive === false ? 'bg-secondary' : 'bg-success'}">${item.isActive === false ? 'غير نشط' : 'نشط'}</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>`;
  } catch (error) {
    console.error('Subscriptions controller error:', error);
    container.innerHTML = '<div class="alert alert-danger mb-0">تعذر تحميل بيانات الاشتراكات.</div>';
  }
}
