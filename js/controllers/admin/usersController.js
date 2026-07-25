export async function initUsersController({ app }) {
  if (!app.isAdmin) return;
  const snapshot = await app.db.collection('users').get();
  const tbody = document.getElementById('adminUsersTable');
  if (!tbody) return;
  tbody.innerHTML = snapshot.docs.map((doc) => {
    const data = doc.data();
    return `<tr><td>${data.name || '-'}</td><td>${data.email || '-'}</td><td>${data.role || 'user'}</td><td>${data.subscription || 'free'}</td><td>${data.isActive ? 'نشط' : 'غير نشط'}</td></tr>`;
  }).join('');
}
