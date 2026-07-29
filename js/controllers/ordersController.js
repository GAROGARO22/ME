export async function initOrdersController({ app }) {
  if (!app.currentUser?.uid) return;

  const tbody = document.getElementById('ordersTableBody');
  if (!tbody) return;

  try {
    const snapshot = await app.db
      .collection('users')
      .doc(app.currentUser.uid)
      .collection('orders')
      .orderBy('createdAt', 'desc')
      .get();

    const statusBadge = (status) => {
      const map = {
        pending:   { label: 'قيد الانتظار', cls: 'badge-warning' },
        sold:      { label: 'تم البيع',     cls: 'badge-success' },
        cancelled: { label: 'ملغى',         cls: 'badge-danger' }
      };
      const s = map[status] || map.pending;
      return `<span class="badge ${s.cls}">${s.label}</span>`;
    };

    tbody.innerHTML = snapshot.docs.length
      ? snapshot.docs.map((doc, i) => {
          const o = doc.data();
          return `
            <tr>
              <td>${i + 1}</td>
              <td>${o.orderNumber || '-'}</td>
              <td>${o.store || '-'}</td>
              <td>${o.productName || '-'}</td>
              <td>${app.formatCurrency(o.purchasePrice, o.currency)}</td>
              <td>${app.formatCurrency(o.salePrice, o.currency)}</td>
              <td>${o.currency || '-'}</td>
              <td>${o.customerName || '-'}</td>
              <td>${statusBadge(o.status)}</td>
              <td>
                <button class="btn btn-sm btn-outline-success" onclick="window.orderStatus('${doc.id}','sold')" title="بيع">
                  <i class="fas fa-check"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger" onclick="window.deleteOrder('${doc.id}')" title="حذف">
                  <i class="fas fa-trash"></i>
                </button>
              </td>
            </tr>`;
        }).join('')
      : '<tr><td colspan="10" class="text-center text-muted">لا توجد طلبات بعد</td></tr>';
  } catch (error) {
    console.error(error);
    app.showNotification('خطأ في تحميل الطلبات', 'error');
  }
}