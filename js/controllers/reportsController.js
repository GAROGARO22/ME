export function initReportsController({ app }) {
  if (!app.currentUser?.uid) return;

  // تهيئة عناصر التحكم
  const reportTypeSelect = document.getElementById('reportType');
  const dateFromInput = document.getElementById('reportDateFrom');
  const dateToInput = document.getElementById('reportDateTo');
  const storeSelect = document.getElementById('reportStore');
  const currencySelect = document.getElementById('reportCurrency');
  const generateBtn = document.querySelector('.btn-primary[onclick*="showNotification"]');

  // تحديث زر التوليد ليشير للدالة الصحيحة
  if (generateBtn) {
    generateBtn.onclick = handleGenerateReport;
    generateBtn.innerHTML = '<i class="fas fa-chart-bar"></i> توليد';
  }

  // تعيين القيم الافتراضية للتواريخ
  setDefaultDates();

  // دالة لتعيين القيم الافتراضية للتواريخ (آخر 30 يوم)
  function setDefaultDates() {
    const today = new Date();
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    if (dateFromInput) {
      dateFromInput.value = thirtyDaysAgo.toISOString().split('T')[0];
    }
    if (dateToInput) {
      dateToInput.value = today.toISOString().split('T')[0];
    }
  }

  // دالة توليد التقرير
  async function handleGenerateReport() {
    const reportType = reportTypeSelect?.value || 'sales';
    const dateFrom = dateFromInput?.value;
    const dateTo = dateToInput?.value;
    const store = storeSelect?.value || '';
    const currency = currencySelect?.value || '';

    if (!dateFrom || !dateTo) {
      app.showNotification('يرجى تحديد نطاق التاريخ', 'warning');
      return;
    }

    const fromDate = new Date(dateFrom);
    const toDate = new Date(dateTo);
    
    if (fromDate > toDate) {
      app.showNotification('تاريخ البداية يجب أن يكون قبل تاريخ النهاية', 'error');
      return;
    }

    // عرض حالة التحميل
    showLoadingState(true);

    try {
      // جلب الطلبات من Firestore
      const ordersSnap = await app.db.collection('users')
        .doc(app.currentUser.uid)
        .collection('orders')
        .get();

      // تصفية البيانات حسب المعايير
      const filteredOrders = [];
      
      ordersSnap.forEach((doc) => {
        const order = doc.data();
        const orderDate = order.createdAt?.toDate ? order.createdAt.toDate() : new Date(order.createdAt);
        
        // تصفية حسب التاريخ
        if (orderDate < fromDate || orderDate > toDate) return;
        
        // تصفية حسب المتجر
        if (store && order.store !== store) return;
        
        // تصفية حسب العملة
        if (currency && order.currency !== currency) return;
        
        filteredOrders.push(order);
      });

      // حساب الإحصائيات
      const stats = calculateStats(filteredOrders, reportType, currency);
      
      // عرض النتائج
      displayReportResults(stats, filteredOrders, reportType);
      
      app.showNotification('تم توليد التقرير بنجاح', 'success');
    } catch (error) {
      console.error('Error generating report:', error);
      app.showNotification('خطأ في توليد التقرير', 'error');
    } finally {
      showLoadingState(false);
    }
  }

  // دالة حساب الإحصائيات
  function calculateStats(orders, reportType, currency) {
    let totalSales = 0;
    let totalProfit = 0;
    let totalOrders = 0;
    let soldOrders = 0;
    let pendingOrders = 0;
    let cancelledOrders = 0;
    const salesByDate = {};
    const salesByStore = {};
    const salesByProduct = {};

    orders.forEach((order) => {
      const salePrice = parseFloat(order.salePrice || 0);
      const purchasePrice = parseFloat(order.purchasePrice || 0);
      const profit = salePrice - purchasePrice;
      const status = order.status || 'pending';
      const store = order.store || 'غير محدد';
      const product = order.productName || 'منتج غير مسمى';
      
      // تحويل التاريخ إلى مفتاح
      const orderDate = order.createdAt?.toDate ? order.createdAt.toDate() : new Date(order.createdAt);
      const dateKey = orderDate.toISOString().split('T')[0];

      //计数
      totalOrders++;
      
      if (status === 'sold') {
        soldOrders++;
        totalSales += salePrice;
        totalProfit += profit;
        
        // تجميع حسب التاريخ
        salesByDate[dateKey] = (salesByDate[dateKey] || 0) + salePrice;
        
        // تجميع حسب المتجر
        salesByStore[store] = (salesByStore[store] || 0) + salePrice;
        
        // تجميع حسب المنتج
        salesByProduct[product] = (salesByProduct[product] || 0) + salePrice;
      } else if (status === 'pending') {
        pendingOrders++;
      } else if (status === 'cancelled') {
        cancelledOrders++;
      }
    });

    // ترتيب المبيعات حسب التاريخ
    const sortedSalesByDate = Object.entries(salesByDate)
      .sort(([a], [b]) => new Date(a) - new Date(b))
      .map(([date, amount]) => ({ date, amount }));

    // ترتيب المبيعات حسب المتجر
    const sortedSalesByStore = Object.entries(salesByStore)
      .sort(([, a], [, b]) => b - a)
      .map(([store, amount]) => ({ store, amount }));

    // ترتيب المبيعات حسب المنتج
    const sortedSalesByProduct = Object.entries(salesByProduct)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10) // أفضل 10 منتجات
      .map(([product, amount]) => ({ product, amount }));

    return {
      totalSales,
      totalProfit,
      totalOrders,
      soldOrders,
      pendingOrders,
      cancelledOrders,
      salesByDate: sortedSalesByDate,
      salesByStore: sortedSalesByStore,
      salesByProduct: sortedSalesByProduct,
      averageOrderValue: soldOrders > 0 ? totalSales / soldOrders : 0,
      profitMargin: totalSales > 0 ? (totalProfit / totalSales) * 100 : 0
    };
  }

  // دالة عرض نتائج التقرير
  function displayReportResults(stats, orders, reportType) {
    const content = document.getElementById('appContent');
    if (!content) return;

    // إزالة أي قسم نتائج سابق
    const existingResults = document.getElementById('reportResults');
    if (existingResults) {
      existingResults.remove();
    }

    // إنشاء قسم النتائج
    const resultsDiv = document.createElement('div');
    resultsDiv.id = 'reportResults';
    resultsDiv.className = 'container-fluid py-4';
    
    const currency = document.getElementById('reportCurrency')?.value || 'SAR';

    resultsDiv.innerHTML = `
      <div class="row g-4 mb-4">
        <!-- البطاقات الإحصائية -->
        <div class="col-md-3">
          <div class="card border-0 shadow-sm h-100">
            <div class="card-body text-center">
              <i class="fas fa-dollar-sign fa-2x text-primary mb-3"></i>
              <h6 class="text-muted">إجمالي المبيعات</h6>
              <h3 class="fw-bold text-primary">${app.formatCurrency(stats.totalSales, currency)}</h3>
            </div>
          </div>
        </div>
        
        <div class="col-md-3">
          <div class="card border-0 shadow-sm h-100">
            <div class="card-body text-center">
              <i class="fas fa-chart-line fa-2x text-success mb-3"></i>
              <h6 class="text-muted">إجمالي الأرباح</h6>
              <h3 class="fw-bold text-success">${app.formatCurrency(stats.totalProfit, currency)}</h3>
              <small class="text-muted">هامش الربح: ${stats.profitMargin.toFixed(1)}%</small>
            </div>
          </div>
        </div>
        
        <div class="col-md-3">
          <div class="card border-0 shadow-sm h-100">
            <div class="card-body text-center">
              <i class="fas fa-shopping-cart fa-2x text-info mb-3"></i>
              <h6 class="text-muted">عدد الطلبات</h6>
              <h3 class="fw-bold text-info">${stats.totalOrders}</h3>
              <small class="text-muted">مباع: ${stats.soldOrders} | معلق: ${stats.pendingOrders}</small>
            </div>
          </div>
        </div>
        
        <div class="col-md-3">
          <div class="card border-0 shadow-sm h-100">
            <div class="card-body text-center">
              <i class="fas fa-receipt fa-2x text-warning mb-3"></i>
              <h6 class="text-muted">متوسط قيمة الطلب</h6>
              <h3 class="fw-bold text-warning">${app.formatCurrency(stats.averageOrderValue, currency)}</h3>
            </div>
          </div>
        </div>
      </div>

      <!-- الرسوم البيانية والجداول -->
      <div class="row g-4">
        <!-- المبيعات حسب التاريخ -->
        <div class="col-lg-6">
          <div class="card border-0 shadow-sm">
            <div class="card-header bg-white">
              <h5 class="mb-0"><i class="fas fa-calendar-alt me-2"></i>المبيعات اليومية</h5>
            </div>
            <div class="card-body">
              ${stats.salesByDate.length > 0 ? `
                <div class="table-responsive">
                  <table class="table table-hover">
                    <thead>
                      <tr>
                        <th>التاريخ</th>
                        <th class="text-end">المبيعات</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${stats.salesByDate.map(item => `
                        <tr>
                          <td>${item.date}</td>
                          <td class="text-end">${app.formatCurrency(item.amount, currency)}</td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                </div>
              ` : '<p class="text-muted text-center">لا توجد بيانات</p>'}
            </div>
          </div>
        </div>

        <!-- المبيعات حسب المتجر -->
        <div class="col-lg-6">
          <div class="card border-0 shadow-sm">
            <div class="card-header bg-white">
              <h5 class="mb-0"><i class="fas fa-store me-2"></i>المبيعات حسب المتجر</h5>
            </div>
            <div class="card-body">
              ${stats.salesByStore.length > 0 ? `
                <div class="table-responsive">
                  <table class="table table-hover">
                    <thead>
                      <tr>
                        <th>المتجر</th>
                        <th class="text-end">المبيعات</th>
                        <th class="text-end">النسبة</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${stats.salesByStore.map(item => `
                        <tr>
                          <td>${item.store}</td>
                          <td class="text-end">${app.formatCurrency(item.amount, currency)}</td>
                          <td class="text-end">${((item.amount / stats.totalSales) * 100).toFixed(1)}%</td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                </div>
              ` : '<p class="text-muted text-center">لا توجد بيانات</p>'}
            </div>
          </div>
        </div>

        <!-- أفضل المنتجات -->
        <div class="col-12">
          <div class="card border-0 shadow-sm">
            <div class="card-header bg-white">
              <h5 class="mb-0"><i class="fas fa-trophy me-2"></i>أفضل المنتجات مبيعاً</h5>
            </div>
            <div class="card-body">
              ${stats.salesByProduct.length > 0 ? `
                <div class="table-responsive">
                  <table class="table table-hover">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>المنتج</th>
                        <th class="text-end">المبيعات</th>
                        <th class="text-end">النسبة</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${stats.salesByProduct.map((item, index) => `
                        <tr>
                          <td><span class="badge ${index < 3 ? 'bg-warning' : 'bg-secondary'}">${index + 1}</span></td>
                          <td>${item.product}</td>
                          <td class="text-end">${app.formatCurrency(item.amount, currency)}</td>
                          <td class="text-end">${((item.amount / stats.totalSales) * 100).toFixed(1)}%</td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                </div>
              ` : '<p class="text-muted text-center">لا توجد بيانات</p>'}
            </div>
          </div>
        </div>
      </div>

      <!-- زر التصدير -->
      <div class="text-center mt-4">
        <button class="btn btn-outline-primary me-2" onclick="window.app.showNotification('ميزة تصدير PDF ستتوفر قريباً', 'info')">
          <i class="fas fa-file-pdf me-2"></i>تصدير PDF
        </button>
        <button class="btn btn-outline-success" onclick="window.app.showNotification('ميزة تصدير Excel ستتوفر قريباً', 'info')">
          <i class="fas fa-file-excel me-2"></i>تصدير Excel
        </button>
      </div>
    `;

    // إضافة القسم بعد نموذج الفلترة
    const filterSection = content.querySelector('.card');
    if (filterSection) {
      filterSection.after(resultsDiv);
    }
  }

  // دالة عرض حالة التحميل
  function showLoadingState(isLoading) {
    const btn = document.querySelector('.btn-primary[onclick*="showNotification"]');
    if (!btn) return;

    if (isLoading) {
      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i> جاري التوليد...';
    } else {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-chart-bar"></i> توليد';
    }
  }

  // الاستماع لتغييرات الفلاتر (اختياري - يمكن تفعيله للتوليد التلقائي)
  // reportTypeSelect?.addEventListener('change', handleGenerateReport);
  // storeSelect?.addEventListener('change', handleGenerateReport);
  // currencySelect?.addEventListener('change', handleGenerateReport);
}
