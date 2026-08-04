export async function initUsersController({ app }) {
  // التحقق من صلاحيات المدير
  if (!app.isAdmin) {
    const content = document.getElementById('appContent');
    if (content) {
      content.innerHTML = `
        <div class="alert alert-danger text-center py-5">
          <i class="fas fa-exclamation-triangle fa-3x mb-3 text-danger"></i>
          <h4>غير مسموح لك بالوصول إلى هذه الصفحة</h4>
          <p class="text-muted">يجب أن تكون مدير نظام للوصول إلى لوحة الإدارة</p>
        </div>
      `;
    }
    return;
  }
  
  try {
    // تحميل بيانات المستخدمين من Firestore
    const snapshot = await app.db.collection('users').get();
    const users = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    
    // تحديث الإحصائيات في البطاقات
    const totalUsers = users.length;
    const activeUsers = users.filter((u) => u.isActive !== false).length;
    const adminUsers = users.filter((u) => u.role === 'admin').length;
    const subscribedUsers = users.filter((u) => u.subscription && u.subscription !== 'free').length;
    
    // تحديث عناصر الإحصائيات
    updateStatElement('statTotalUsers', totalUsers);
    updateStatElement('statActiveUsers', activeUsers);
    updateStatElement('statAdmins', adminUsers);
    updateStatElement('statSubscriptions', subscribedUsers);
    
    // عرض المستخدمين في الجدول
    renderUsersTable(users);
    
    // تفعيل أحداث البحث والفلترة
    setupSearchAndFilter(users);
    
    // تفعيل زر إضافة مستخدم
    document.getElementById('addUserBtn')?.addEventListener('click', () => showAddUserModal());
    
    // تفعيل تحديد الكل
    document.getElementById('selectAllUsers')?.addEventListener('change', (e) => {
      document.querySelectorAll('.user-checkbox').forEach(cb => cb.checked = e.target.checked);
    });
    
  } catch (error) {
    console.error('Users controller error:', error);
    const tbody = document.getElementById('adminUsersTable');
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" class="text-center text-danger py-5">
            <i class="fas fa-exclamation-triangle fa-3x mb-3"></i>
            <br>تعذر تحميل بيانات المستخدمين.
            <br><small>${error.message}</small>
          </td>
        </tr>
      `;
    }
  }
  
  // دالة مساعدة لتحديث عناصر الإحصائيات
  function updateStatElement(elementId, value) {
    const el = document.getElementById(elementId);
    if (el) {
      el.textContent = value;
      // تأثير حركي بسيط
      el.style.transition = 'transform 0.3s';
      el.style.transform = 'scale(1.2)';
      setTimeout(() => el.style.transform = 'scale(1)', 300);
    }
  }
  
  // دالة عرض جدول المستخدمين
  function renderUsersTable(users) {
    const tbody = document.getElementById('adminUsersTable');
    if (!tbody) return;
    
    if (users.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" class="text-center text-muted py-5">
            <i class="fas fa-inbox fa-3x mb-3 text-muted"></i>
            <br>لا توجد بيانات للمستخدمين بعد.
          </td>
        </tr>
      `;
      document.getElementById('usersCountLabel').textContent = 'عرض 0 من 0 مستخدم';
      return;
    }
    
    tbody.innerHTML = users.map((user, index) => `
      <tr>
        <td><input type="checkbox" class="form-check-input user-checkbox" value="${user.id}"></td>
        <td>
          <div class="d-flex align-items-center">
            ${user.photoURL 
              ? `<img src="${user.photoURL}" alt="" width="40" height="40" class="rounded-circle ms-2 border">` 
              : `<div class="bg-primary text-white rounded-circle d-flex align-items-center justify-content-center ms-2" style="width:40px;height:40px;font-weight:bold;">${(user.name || user.email || '?')[0].toUpperCase()}</div>`
            }
            <div>
              <div class="fw-bold">${user.name || '-'}</div>
              <small class="text-muted">${user.phone || ''}</small>
            </div>
          </div>
        </td>
        <td>${user.email || '-'}</td>
        <td>${getRoleBadge(user.role)}</td>
        <td>${getSubscriptionBadge(user.subscription)}</td>
        <td>
          <span class="badge ${user.isActive === false ? 'bg-secondary' : 'bg-success'}">
            ${user.isActive === false ? 'غير نشط' : 'نشط'}
          </span>
        </td>
        <td>${user.createdAt ? app.formatDate(user.createdAt) : '-'}</td>
        <td>
          <div class="d-flex gap-1">
            <button class="btn btn-sm btn-outline-primary" title="عرض" onclick="viewUser('${user.id}')">
              <i class="fas fa-eye"></i>
            </button>
            <button class="btn btn-sm btn-outline-warning" title="تعديل" onclick="editUser('${user.id}')">
              <i class="fas fa-edit"></i>
            </button>
            <button class="btn btn-sm btn-outline-danger" title="حذف" onclick="deleteUser('${user.id}')">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </td>
      </tr>
    `).join('');
    
    // تحديث عداد المستخدمين
    const countLabel = document.getElementById('usersCountLabel');
    if (countLabel) {
      countLabel.textContent = `عرض ${users.length} من ${users.length} مستخدم`;
    }
  }
  
  // دالة الحصول على شارة الدور
  function getRoleBadge(role) {
    const badges = {
      admin: '<span class="badge bg-danger"><i class="fas fa-crown me-1"></i>مدير نظام</span>',
      subscriber: '<span class="badge bg-info text-dark"><i class="fas fa-user me-1"></i>مشترك</span>',
      user: '<span class="badge bg-secondary"><i class="fas fa-user me-1"></i>مستخدم</span>'
    };
    return badges[role] || badges.user;
  }
  
  // دالة الحصول على شارة الاشتراك
  function getSubscriptionBadge(subscription) {
    const badges = {
      premium: '<span class="badge bg-warning text-dark"><i class="fas fa-star me-1"></i>بريميوم</span>',
      basic: '<span class="badge bg-info text-dark"><i class="fas fa-check me-1"></i>أساسي</span>',
      free: '<span class="badge bg-secondary"><i class="fas fa-gift me-1"></i>مجاني</span>'
    };
    return badges[subscription] || badges.free;
  }
  
  // دالة إعداد البحث والفلترة
  function setupSearchAndFilter(users) {
    const searchInput = document.getElementById('userSearchInput');
    const filterRole = document.getElementById('userFilterRole');
    
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const filtered = users.filter(user => 
          (user.name && user.name.toLowerCase().includes(searchTerm)) ||
          (user.email && user.email.toLowerCase().includes(searchTerm))
        );
        renderUsersTable(filtered);
      });
    }
    
    if (filterRole) {
      filterRole.addEventListener('change', (e) => {
        const roleFilter = e.target.value;
        const filtered = roleFilter 
          ? users.filter(user => user.role === roleFilter)
          : users;
        renderUsersTable(filtered);
      });
    }
  }
  
  // دوال الإجراءات (متاحة عالمياً)
  window.viewUser = async function(userId) {
    try {
      const userDoc = await app.db.collection('users').doc(userId).get();
      if (userDoc.exists) {
        const userData = userDoc.data();
        const modalHtml = `
          <div class="modal fade" id="viewUserModal" tabindex="-1">
            <div class="modal-dialog modal-dialog-centered">
              <div class="modal-content">
                <div class="modal-header bg-light">
                  <h5 class="modal-title"><i class="fas fa-user me-2"></i>تفاصيل المستخدم</h5>
                  <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                  <div class="text-center mb-4">
                    ${userData.photoURL 
                      ? `<img src="${userData.photoURL}" class="rounded-circle mb-3" width="100" height="100">`
                      : `<div class="bg-primary text-white rounded-circle d-flex align-items-center justify-content-center mx-auto mb-3" style="width:100px;height:100px;font-size:2rem;">${(userData.name || userData.email || '?')[0].toUpperCase()}</div>`
                    }
                    <h4>${userData.name || '-'}</h4>
                    <p class="text-muted">${userData.email || '-'}</p>
                  </div>
                  <div class="row g-3">
                    <div class="col-md-6">
                      <div class="card bg-light border-0">
                        <div class="card-body">
                          <small class="text-muted">الدور</small>
                          <div class="fw-bold">${getRoleBadge(userData.role)}</div>
                        </div>
                      </div>
                    </div>
                    <div class="col-md-6">
                      <div class="card bg-light border-0">
                        <div class="card-body">
                          <small class="text-muted">الاشتراك</small>
                          <div class="fw-bold">${getSubscriptionBadge(userData.subscription)}</div>
                        </div>
                      </div>
                    </div>
                    <div class="col-md-6">
                      <div class="card bg-light border-0">
                        <div class="card-body">
                          <small class="text-muted">الحالة</small>
                          <div class="fw-bold">
                            <span class="badge ${userData.isActive === false ? 'bg-secondary' : 'bg-success'}">
                              ${userData.isActive === false ? 'غير نشط' : 'نشط'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div class="col-md-6">
                      <div class="card bg-light border-0">
                        <div class="card-body">
                          <small class="text-muted">تاريخ الانضمام</small>
                          <div class="fw-bold">${userData.createdAt ? app.formatDate(userData.createdAt) : '-'}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div class="modal-footer">
                  <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">إغلاق</button>
                  <button type="button" class="btn btn-primary" onclick="editUser('${userId}')">
                    <i class="fas fa-edit me-1"></i>تعديل
                  </button>
                </div>
              </div>
            </div>
          </div>
        `;
        
        // إزالة أي modal سابق
        document.getElementById('viewUserModal')?.remove();
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        const modal = new bootstrap.Modal(document.getElementById('viewUserModal'));
        modal.show();
        
        document.getElementById('viewUserModal').addEventListener('hidden.bs.modal', function() {
          this.remove();
        });
      }
    } catch (error) {
      console.error('Error viewing user:', error);
      app.showNotification('خطأ في عرض تفاصيل المستخدم', 'error');
    }
  };
  
  window.editUser = function(userId) {
    app.showNotification('سيتم تفعيل ميزة تعديل المستخدمين قريباً', 'info');
  };
  
  window.deleteUser = async function(userId) {
    if (confirm('هل أنت متأكد من حذف هذا المستخدم؟\nهذا الإجراء لا يمكن التراجع عنه.')) {
      try {
        await app.db.collection('users').doc(userId).delete();
        app.showNotification('تم حذف المستخدم بنجاح', 'success');
        // إعادة تحميل البيانات
        initUsersController({ app });
      } catch (error) {
        console.error('Error deleting user:', error);
        app.showNotification('خطأ في حذف المستخدم: ' + error.message, 'error');
      }
    }
  };
  
  window.showAddUserModal = function() {
    app.showNotification('سيتم تفعيل ميزة إضافة المستخدمين قريباً', 'info');
  };
}
