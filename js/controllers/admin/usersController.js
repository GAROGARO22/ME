export async function initUsersController({ app }) {
  if (!app.isAdmin) return;
  
  try {
    // تحميل بيانات المستخدمين
    const snapshot = await app.db.collection('users').get();
    const users = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    const tbody = document.getElementById('adminUsersTable');
    
    if (!tbody) return;

    const roleLabel = (role) => {
      if (role === 'admin') return '<span class="badge badge-role badge-role-admin">مدير</span>';
      if (role === 'subscriber') return '<span class="badge badge-role badge-role-subscriber">مشترك</span>';
      return '<span class="badge badge-role badge-role-user">مستخدم</span>';
    };

    const subscriptionLabel = (sub) => {
      if (sub === 'premium') return '<span class="badge bg-warning text-dark">بريميوم</span>';
      if (sub === 'basic') return '<span class="badge bg-info text-dark">أساسي</span>';
      return '<span class="badge bg-secondary">مجاني</span>';
    };

    const activeUsers = users.filter((user) => user.isActive !== false).length;
    const adminUsers = users.filter((user) => user.role === 'admin').length;
    const subscribedUsers = users.filter((user) => user.subscription && user.subscription !== 'free').length;

    // تحديث الإحصائيات
    const totalEl = document.getElementById('statTotalUsers');
    const activeEl = document.getElementById('statActiveUsers');
    const adminsEl = document.getElementById('statAdmins');
    const subsEl = document.getElementById('statSubscriptions');
    const ordersEl = document.getElementById('statOrders');
    const customersEl = document.getElementById('statCustomers');
    const activePercentEl = document.getElementById('statActivePercent');

    if (totalEl) totalEl.textContent = users.length;
    if (activeEl) activeEl.textContent = activeUsers;
    if (adminsEl) adminsEl.textContent = adminUsers;
    if (subsEl) subsEl.textContent = subscribedUsers;
    if (ordersEl) ordersEl.textContent = '0';
    if (customersEl) customersEl.textContent = '0';
    if (activePercentEl && users.length > 0) {
      activePercentEl.textContent = Math.round((activeUsers / users.length) * 100);
    }

    // عرض المستخدمين في الجدول
    tbody.innerHTML = users.length
      ? users.map((user) => `
          <tr>
            <td><input type="checkbox" class="form-check-input user-checkbox" value="${user.id}"></td>
            <td>
              <div class="d-flex align-items-center">
                ${user.photoURL ? `<img src="${user.photoURL}" alt="" width="32" height="32" class="rounded-circle ms-2">` : ''}
                <div>
                  <div class="fw-bold">${user.name || user.email || '-'}</div>
                </div>
              </div>
            </td>
            <td>${user.email || '-'}</td>
            <td>${roleLabel(user.role)}</td>
            <td>${subscriptionLabel(user.subscription)}</td>
            <td><span class="badge ${user.isActive === false ? 'bg-secondary' : 'bg-success'}">${user.isActive === false ? 'غير نشط' : 'نشط'}</span></td>
            <td>${user.createdAt ? app.formatDate(user.createdAt) : '-'}</td>
            <td>
              <div class="d-flex gap-1">
                <button class="action-btn action-btn-view" title="عرض" data-user-id="${user.id}">
                  <i class="fas fa-eye"></i>
                </button>
                <button class="action-btn action-btn-edit" title="تعديل" data-user-id="${user.id}">
                  <i class="fas fa-edit"></i>
                </button>
                <button class="action-btn action-btn-delete" title="حذف" data-user-id="${user.id}">
                  <i class="fas fa-trash"></i>
                </button>
              </div>
            </td>
          </tr>`).join('')
      : '<tr><td colspan="8" class="text-center text-muted py-5"><i class="fas fa-inbox fa-3x mb-3 text-muted"></i><br>لا توجد بيانات للمستخدمين بعد.</td></tr>';

    // تحديث عداد المستخدمين
    const countLabel = document.getElementById('usersCountLabel');
    if (countLabel) {
      countLabel.textContent = `عرض ${users.length} من ${users.length} مستخدم`;
    }

    // تفعيل أزرار الإجراءات
    setTimeout(() => {
      document.querySelectorAll('.action-btn-view').forEach(btn => {
        btn.addEventListener('click', () => viewUser(btn.dataset.userId));
      });
      document.querySelectorAll('.action-btn-edit').forEach(btn => {
        btn.addEventListener('click', () => editUser(btn.dataset.userId));
      });
      document.querySelectorAll('.action-btn-delete').forEach(btn => {
        btn.addEventListener('click', () => deleteUser(btn.dataset.userId));
      });
    }, 100);

  } catch (error) {
    console.error('Users controller error:', error);
    const tbody = document.getElementById('adminUsersTable');
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="8" class="text-center text-danger py-5"><i class="fas fa-exclamation-triangle fa-3x mb-3"></i><br>تعذر تحميل بيانات المستخدمين.</td></tr>';
    }
  }

  // دوال مساعدة
  async function viewUser(userId) {
    try {
      const userDoc = await app.db.collection('users').doc(userId).get();
      if (userDoc.exists) {
        const userData = userDoc.data();
        app.showNotification(`عرض تفاصيل المستخدم: ${userData.email}`, 'info');
      }
    } catch (error) {
      console.error('Error viewing user:', error);
      app.showNotification('خطأ في عرض تفاصيل المستخدم', 'error');
    }
  }

  async function editUser(userId) {
    app.showNotification('سيتم تفعيل ميزة تعديل المستخدمين قريباً', 'info');
  }

  async function deleteUser(userId) {
    if (confirm('هل أنت متأكد من حذف هذا المستخدم؟')) {
      try {
        await app.db.collection('users').doc(userId).delete();
        app.showNotification('تم حذف المستخدم بنجاح', 'success');
        initUsersController({ app });
      } catch (error) {
        console.error('Error deleting user:', error);
        app.showNotification('خطأ في حذف المستخدم', 'error');
      }
    }
  }
}
