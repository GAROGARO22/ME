export async function initCustomersController({ app }) {
  if (!app.currentUser?.uid) return;

  try {
    const snapshot = await app.db
      .collection('users')
      .doc(app.currentUser.uid)
      .collection('customers')
      .orderBy('createdAt', 'desc')
      .get();

    const tbody = document.getElementById('customersTableBody');
    if (!tbody) return;

    tbody.innerHTML = snapshot.docs.map((doc, index) => {
      const customer = doc.data();
      return `
        <tr>
          <td>${index + 1}</td>
          <td>${customer.name || '-'}</td>
          <td>${customer.phone || '-'}</td>
          <td>${customer.email || '-'}</td>
          <td>${customer.country || '-'}</td>
          <td><span class="badge badge-success">${customer.status || 'active'}</span></td>
          <td>${customer.totalOrders || 0}</td>
          <td><button class="btn btn-sm btn-outline-primary" disabled><i class="fas fa-edit"></i></button></td>
        </tr>
      `;
    }).join('');
  } catch (error) {
    console.error(error);
    app.showNotification('خطأ في تحميل العملاء', 'error');
  }
}
