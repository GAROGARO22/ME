export async function initUsersController({ app }) {
  if (!app.isAdmin) return;

  try {
    const snapshot = await app.db.collection('users').get();
    const users = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    const tbody = document.getElementById('adminUsersTable');

    if (!tbody) return;

    const roleLabel = (role) => {
      if (role === 'admin') return 'مدير';
      if (role === 'subscriber') return 'مشترك';
      return 'مستخدم';
    };

    const subscriptionLabel = (subscription) => {
      if (subscription === 'premium') return 'بريميوم';
      if (subscription === 'basic') return 'أساسي';
      return 'مجاني';
    };

    const activeUsers = users.filter((user) => user.isActive !== false).length;
    const adminUsers = users.filter((user) => user.role === 'admin').length;

    document.getElementById('adminUsersCount').textContent = users.length;
    document.getElementById('adminActiveUsersCount').textContent = activeUsers;
    document.getElementById('adminAdminCount').textContent = adminUsers;
    document.getElementById('adminSubscriptionCount').textContent = users.filter((user) => user.subscription).length;

    tbody.innerHTML = users.length
      ? users.map((user) => `
          <tr>
            <td>${user.name || user.email || '-'}</td>
            <td>${user.email || '-'}</td>
            <td><span class="badge bg-light text-dark">${roleLabel(user.role)}</span></td>
            <td>${subscriptionLabel(user.subscription)}</td>
            <td><span class="badge ${user.isActive === false ? 'bg-secondary' : 'bg-success'}">${user.isActive === false ? 'غير نشط' : 'نشط'}</span></td>
          </tr>`).join('')
      : '<tr><td colspan="5" class="text-center text-muted">لا توجد بيانات للمستخدمين بعد.</td></tr>';

    document.querySelectorAll('[data-admin-tab]').forEach((button) => {
      button.addEventListener('click', () => {
        const target = button.getAttribute('data-admin-tab');
        document.querySelectorAll('.admin-tab-pane').forEach((pane) => {
          pane.classList.toggle('d-none', pane.id !== `${target}Pane`);
        });
        document.querySelectorAll('[data-admin-tab]').forEach((item) => item.classList.toggle('active', item === button));
      });
    });
  } catch (error) {
    console.error('Users controller error:', error);
    const tbody = document.getElementById('adminUsersTable');
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-center text-danger">تعذر تحميل بيانات المستخدمين.</td></tr>';
    }
  }
}
