let unsubscribe = null;

function renderNotifications(app, snapshot) {
  const container = document.getElementById('notificationsList');
  const badge = document.getElementById('notificationCount');
  if (!container) return;

  const items = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  const unread = items.filter((item) => !item.read).length;

  if (badge) {
    badge.textContent = unread;
    badge.classList.toggle('d-none', unread === 0);
  }

  container.innerHTML = items.length
    ? items.map((item) => `
        <div class="list-group-item border-0 px-3 py-2">
          <div class="d-flex justify-content-between gap-3">
            <div>
              <div class="fw-bold">${item.title}</div>
              <small class="text-muted">${item.message}</small>
            </div>
            ${!item.read ? `<button class="btn btn-link btn-sm p-0" data-mark-read="${item.id}"><i class="fas fa-check"></i></button>` : ''}
          </div>
        </div>
      `).join('')
    : '<div class="p-3 text-muted">لا توجد إشعارات بعد</div>';

  container.querySelectorAll('[data-mark-read]').forEach((button) => {
    button.addEventListener('click', async (event) => {
      event.preventDefault();
      const id = button.getAttribute('data-mark-read');
      const notificationRef = app.db.collection('users').doc(app.currentUser.uid).collection('notifications').doc(id);
      await notificationRef.update({ read: true });
    });
  });
}

function initNotifications(app) {
  if (!app?.db || !app?.currentUser?.uid) return;
  if (unsubscribe) unsubscribe();

  const notificationsRef = app.db.collection('users').doc(app.currentUser.uid).collection('notifications');
  unsubscribe = notificationsRef.orderBy('createdAt', 'desc').onSnapshot((snapshot) => {
    renderNotifications(app, snapshot);
  });
}

function destroyNotifications() {
  if (unsubscribe) unsubscribe();
  unsubscribe = null;
}

export { initNotifications, destroyNotifications };
