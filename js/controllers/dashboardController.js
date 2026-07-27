export function initDashboardController({ app }) {
  if (!app.currentUser?.uid) return;

  Promise.all([
    app.db.collection('users').doc(app.currentUser.uid).collection('customers').get(),
    app.db.collection('orders').where('userId', '==', app.currentUser.uid).get()
  ])
    .then(([customersSnap, ordersSnap]) => {
      let totalSales = 0;
      let totalProfit = 0;
      let totalOrders = 0;

      ordersSnap.forEach((doc) => {
        const order = doc.data();
        if (order.status === 'sold') {
          totalOrders += 1;
          totalSales += parseFloat(order.salePrice || 0);
          totalProfit += (parseFloat(order.salePrice || 0) - parseFloat(order.purchasePrice || 0));
        }
      });

      document.getElementById('totalSales').textContent = app.formatCurrency(totalSales);
      document.getElementById('totalProfit').textContent = app.formatCurrency(totalProfit);
      document.getElementById('totalOrders').textContent = ordersSnap.size;
      document.getElementById('totalCustomers').textContent = customersSnap.size;

      const activityBody = document.getElementById('recentActivity');
      const recentOrders = ordersSnap.docs.slice(0, 5);
      activityBody.innerHTML = recentOrders.length
        ? recentOrders.map((doc) => {
            const order = doc.data();
            return `
              <tr>
                <td>${app.formatDate(order.createdAt)}</td>
                <td><span class="badge badge-warning">${order.status || 'pending'}</span></td>
                <td>${order.productName || 'منتج'}</td>
                <td>${app.formatCurrency(order.salePrice || 0)}</td>
              </tr>
            `;
          }).join('')
        : '<tr><td colspan="4" class="text-muted">لا توجد طلبات بعد</td></tr>';
    })
    .catch((error) => {
      console.error(error);
      app.showNotification('خطأ في تحميل لوحة التحكم', 'error');
    });
}
