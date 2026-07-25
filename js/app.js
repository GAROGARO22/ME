// Meraj SaaS - Main Application JavaScript
// Firebase Integration & Business Logic

// ============================================
// Firebase Configuration
// ============================================
const firebaseConfig = {
  apiKey: "AIzaSyATErm0RWNW9QTgne2lzk4t-HQEIRRitDA",
  authDomain: "mia3raj.firebaseapp.com",
  projectId: "mia3raj",
  storageBucket: "mia3raj.firebasestorage.app",
  messagingSenderId: "618757631405",
  appId: "1:618757631405:web:4deb8767bb84c4e07c0524",
  measurementId: "G-Z1VQ0GY9C3"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// ============================================
// Global State
// ============================================
let currentUser = null;
let userData = null;
let isAdmin = false;

// ============================================
// Authentication Functions
// ============================================

// Google Sign In
function handleGoogleLogin() {
    const provider = new firebase.auth.GoogleAuthProvider();
    
    auth.signInWithPopup(provider)
        .then((result) => {
            console.log('Login successful:', result.user);
            checkUserPermissions(result.user);
        })
        .catch((error) => {
            console.error('Login error:', error);
            showNotification('خطأ في تسجيل الدخول', 'error');
        });
}

// Logout
function handleLogout() {
    auth.signOut()
        .then(() => {
            console.log('Logout successful');
            window.location.reload();
        })
        .catch((error) => {
            console.error('Logout error:', error);
        });
}

// Check User Permissions
async function checkUserPermissions(user) {
    try {
        const userDoc = await db.collection('users').doc(user.uid).get();
        
        if (userDoc.exists) {
            userData = userDoc.data();
            isAdmin = userData.role === 'admin';
        } else {
            // Create new user document
            userData = {
                email: user.email,
                name: user.displayName,
                photoURL: user.photoURL,
                role: 'user',
                subscription: 'free',
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                isActive: true
            };
            
            await db.collection('users').doc(user.uid).set(userData);
        }
        
        currentUser = user;
        initializeApp();
        
    } catch (error) {
        console.error('Error checking permissions:', error);
        showNotification('خطأ في تحميل البيانات', 'error');
    }
}

// Auth State Observer
auth.onAuthStateChanged((user) => {
    if (user) {
        checkUserPermissions(user);
    } else {
        // Show login page
        document.getElementById('loginPage').classList.remove('d-none');
        document.getElementById('mainApp').classList.add('d-none');
    }
});

// ============================================
// App Initialization
// ============================================

function initializeApp() {
    // Hide login, show main app
    document.getElementById('loginPage').classList.add('d-none');
    document.getElementById('mainApp').classList.remove('d-none');
    
    // Set user name
    document.getElementById('userName').textContent = currentUser.displayName || 'مستخدم';
    
    // Show admin menu if admin
    if (isAdmin) {
        document.querySelectorAll('.admin-only').forEach(el => {
            el.classList.remove('d-none');
        });
    }
    
    // Load dashboard data
    loadDashboardData();
    
    // Setup event listeners
    setupEventListeners();
    
    showNotification('تم تسجيل الدخول بنجاح', 'success');

    // ====================================================
    // تشغيل نافذة الأتمتة الذكية بعد 5 ثوانٍ من تسجيل الدخول
    // ====================================================
    const hasSeenModal = localStorage.getItem('meraj_automation_seen');
    const isGmailConnected = false; // لاحقاً سنجعلها مرتبطة بقاعدة البيانات
    
    if (!hasSeenModal && !isGmailConnected) {
        setTimeout(() => {
            var myModalEl = document.getElementById('smartAutomationModal');
            if (myModalEl) {
                var automationModal = new bootstrap.Modal(myModalEl);
                automationModal.show();
            }
        }, 5000);
    }

    // حفظ الحدث عند الضغط على زر التخطي أو أي مكان لإغلاق النافذة
    const smartModal = document.getElementById('smartAutomationModal');
    if(smartModal) {
        smartModal.addEventListener('hidden.bs.modal', function () {
            localStorage.setItem('meraj_automation_seen', 'true');
        });
    }
}

// ============================================
// Event Listeners
// ============================================

function setupEventListeners() {
    // Sidebar toggle
    document.getElementById('sidebarCollapse')?.addEventListener('click', () => {
        document.getElementById('sidebar').classList.toggle('active');
        document.getElementById('content').classList.toggle('active');
    });
    
    // Navigation
    document.querySelectorAll('[data-page]').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const page = e.target.closest('a').dataset.page;
            navigateTo(page);
        });
    });
    
    // Search filters
    setupSearchFilters();
}

function setupSearchFilters() {
    // Customer search
    document.getElementById('customerSearch')?.addEventListener('input', debounce(filterCustomers, 300));
    
    // Order search
    document.getElementById('orderSearch')?.addEventListener('input', debounce(filterOrders, 300));
}

// Debounce utility
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// ============================================
// Navigation
// ============================================

function navigateTo(page) {
    // Hide all pages
    document.querySelectorAll('.page-content').forEach(p => {
        p.classList.add('d-none');
        p.classList.remove('active');
    });
    
    // Remove active class from sidebar
    document.querySelectorAll('.sidebar ul li').forEach(li => {
        li.classList.remove('active');
    });
    
    // Show selected page
    const targetPage = document.getElementById(`${page}Page`);
    if (targetPage) {
        targetPage.classList.remove('d-none');
        targetPage.classList.add('active');
    }
    
    // Update sidebar active state
    const activeLink = document.querySelector(`[data-page="${page}"]`);
    if (activeLink) {
        activeLink.closest('li').classList.add('active');
    }
    
    // Load page data
    loadPageData(page);
}

// ============================================
// Page Data Loading
// ============================================

async function loadPageData(page) {
    switch(page) {
        case 'dashboard':
            loadDashboardData();
            break;
        case 'customers':
            loadCustomers();
            break;
        case 'orders':
            loadOrders();
            break;
        case 'reports':
            // Reports loaded on demand
            break;
        case 'admin':
            if (isAdmin) {
                loadAdminData();
            }
            break;
    }
}

// ============================================
// Dashboard Functions
// ============================================

async function loadDashboardData() {
    try {
        const userId = currentUser.uid;
        
        // Get customers count
        const customersSnapshot = await db.collection('customers')
            .where('userId', '==', userId)
            .get();
        
        // Get orders
        const ordersSnapshot = await db.collection('orders')
            .where('userId', '==', userId)
            .get();
        
        let totalSales = 0;
        let totalProfit = 0;
        let totalOrders = ordersSnapshot.size;
        
        ordersSnapshot.forEach(doc => {
            const order = doc.data();
            if (order.salePrice && order.status === 'sold') {
                totalSales += parseFloat(order.salePrice) || 0;
                totalProfit += (parseFloat(order.salePrice) - parseFloat(order.purchasePrice)) || 0;
            }
        });
        
        // Update UI
        document.getElementById('totalSales').textContent = formatCurrency(totalSales);
        document.getElementById('totalProfit').textContent = formatCurrency(totalProfit);
        document.getElementById('totalOrders').textContent = totalOrders;
        document.getElementById('totalCustomers').textContent = customersSnapshot.size;
        
        // Load recent activity
        loadRecentActivity(ordersSnapshot.docs.slice(0, 5));
        
    } catch (error) {
        console.error('Error loading dashboard:', error);
    }
}

function loadRecentActivity(orders) {
    const tbody = document.getElementById('recentActivity');
    if (!tbody) return;
    
    tbody.innerHTML = orders.map(order => `
        <tr>
            <td>${formatDate(order.createdAt)}</td>
            <td><span class="badge ${getStatusBadge(order.status)}">${getStatusText(order.status)}</span></td>
            <td>${order.productName || 'منتج'}</td>
            <td>${formatCurrency(order.salePrice || 0)}</td>
        </tr>
    `).join('');
}

// ============================================
// Customer Management
// ============================================

async function loadCustomers() {
    try {
        const snapshot = await db.collection('customers')
            .where('userId', '==', currentUser.uid)
            .orderBy('createdAt', 'desc')
            .get();
        
        const tbody = document.getElementById('customersTableBody');
        if (!tbody) return;
        
        tbody.innerHTML = snapshot.docs.map((doc, index) => {
            const customer = doc.data();
            return `
                <tr>
                    <td>${index + 1}</td>
                    <td>${customer.name}</td>
                    <td>${customer.phone}</td>
                    <td>${customer.email || '-'}</td>
                    <td>${getCountryName(customer.country)}</td>
                    <td><span class="badge ${getStatusBadge(customer.status)}">${getStatusText(customer.status)}</span></td>
                    <td>${customer.totalOrders || 0}</td>
                    <td>
                        <button class="btn btn-sm btn-outline-primary" onclick="editCustomer('${doc.id}')">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger" onclick="deleteCustomer('${doc.id}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
        
    } catch (error) {
        console.error('Error loading customers:', error);
        showNotification('خطأ في تحميل العملاء', 'error');
    }
}

function saveCustomer() {
    const form = document.getElementById('addCustomerForm');
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }
    
    const formData = new FormData(form);
    const customer = {
        userId: currentUser.uid,
        name: formData.get('name'),
        phone: formData.get('phone'),
        email: formData.get('email'),
        country: formData.get('country'),
        address: formData.get('address'),
        status: 'active',
        totalOrders: 0,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    db.collection('customers').add(customer)
        .then(() => {
            showNotification('تم إضافة العميل بنجاح', 'success');
            bootstrap.Modal.getInstance(document.getElementById('addCustomerModal')).hide();
            loadCustomers();
        })
        .catch(error => {
            console.error('Error saving customer:', error);
            showNotification('خطأ في الحفظ', 'error');
        });
}

function filterCustomers() {
    const search = document.getElementById('customerSearch').value.toLowerCase();
    const status = document.getElementById('customerStatusFilter').value;
    const country = document.getElementById('customerCountryFilter').value;
    
    // Implement client-side filtering or update Firestore query
    console.log('Filtering customers:', { search, status, country });
}

// ============================================
// Order Management
// ============================================

async function loadOrders() {
    try {
        const snapshot = await db.collection('orders')
            .where('userId', '==', currentUser.uid)
            .orderBy('createdAt', 'desc')
            .get();
        
        const tbody = document.getElementById('ordersTableBody');
        if (!tbody) return;
        
        tbody.innerHTML = snapshot.docs.map((doc, index) => {
            const order = doc.data();
            return `
                <tr>
                    <td>${index + 1}</td>
                    <td>${order.orderNumber}</td>
                    <td>${getStoreName(order.store)}</td>
                    <td>${order.productName}</td>
                    <td>${formatCurrency(order.purchasePrice)}</td>
                    <td>${order.salePrice ? formatCurrency(order.salePrice) : '-'}</td>
                    <td>${order.currency}</td>
                    <td>${order.customerName || '-'}</td>
                    <td><span class="badge ${getStatusBadge(order.status)}">${getStatusText(order.status)}</span></td>
                    <td>
                        <button class="btn btn-sm btn-outline-primary" onclick="editOrder('${doc.id}')">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-success" onclick="linkCustomer('${doc.id}')">
                            <i class="fas fa-link"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger" onclick="deleteOrder('${doc.id}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
        
    } catch (error) {
        console.error('Error loading orders:', error);
        showNotification('خطأ في تحميل الطلبات', 'error');
    }
}

function saveOrder() {
    const form = document.getElementById('addOrderForm');
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }
    
    const formData = new FormData(form);
    const order = {
        userId: currentUser.uid,
        orderNumber: formData.get('orderNumber'),
        store: formData.get('store'),
        productName: formData.get('productName'),
        purchasePrice: parseFloat(formData.get('purchasePrice')),
        salePrice: parseFloat(formData.get('salePrice')) || 0,
        currency: formData.get('currency'),
        customerId: formData.get('customerId'),
        status: 'pending',
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    db.collection('orders').add(order)
        .then(() => {
            showNotification('تم إضافة الطلب بنجاح', 'success');
            bootstrap.Modal.getInstance(document.getElementById('addOrderModal')).hide();
            loadOrders();
        })
        .catch(error => {
            console.error('Error saving order:', error);
            showNotification('خطأ في الحفظ', 'error');
        });
}

// ============================================
// Email Sync (Gmail Integration)
// ============================================

async function syncEmails() {
    showLoading(true);
    
    try {
        // سيتم التحديث لاحقاً لتتوافق مع الـ API الجديد الذي نبنيه في Vercel
        showNotification('تمت تهيئة نظام المزامنة الذكي', 'success');
        
    } catch (error) {
        console.error('Error syncing emails:', error);
        showNotification('خطأ في المزامنة', 'error');
    } finally {
        showLoading(false);
    }
}

// ============================================
// Reports
// ============================================

async function generateReport() {
    const reportType = document.getElementById('reportType').value;
    const dateFrom = document.getElementById('reportDateFrom').value;
    const dateTo = document.getElementById('reportDateTo').value;
    const store = document.getElementById('reportStore').value;
    const currency = document.getElementById('reportCurrency').value;
    
    showLoading(true);
    
    try {
        let query = db.collection('orders')
            .where('userId', '==', currentUser.uid);
        
        if (store) {
            query = query.where('store', '==', store);
        }
        
        const snapshot = await query.get();
        
        // Process data based on report type
        let reportData = processReportData(snapshot.docs, reportType, currency);
        
        // Display report
        displayReport(reportData, reportType);
        
    } catch (error) {
        console.error('Error generating report:', error);
        showNotification('خطأ في إنشاء التقرير', 'error');
    } finally {
        showLoading(false);
    }
}

function processReportData(docs, type, currency) {
    let totalSales = 0;
    let totalProfit = 0;
    let totalOrders = 0;
    
    docs.forEach(doc => {
        const order = doc.data();
        if (order.status === 'sold') {
            totalOrders++;
            totalSales += parseFloat(order.salePrice) || 0;
            totalProfit += (parseFloat(order.salePrice) - parseFloat(order.purchasePrice)) || 0;
        }
    });
    
    return {
        totalSales,
        totalProfit,
        totalOrders,
        orders: docs.map(doc => ({ id: doc.id, ...doc.data() }))
    };
}

function displayReport(data, type) {
    const container = document.getElementById('reportResults');
    
    container.innerHTML = `
        <div class="row g-4 mb-4">
            <div class="col-md-4">
                <div class="card stat-card bg-primary text-white">
                    <div class="card-body">
                        <h6>إجمالي المبيعات</h6>
                        <h3>${formatCurrency(data.totalSales)}</h3>
                    </div>
                </div>
            </div>
            <div class="col-md-4">
                <div class="card stat-card bg-success text-white">
                    <div class="card-body">
                        <h6>إجمالي الأرباح</h6>
                        <h3>${formatCurrency(data.totalProfit)}</h3>
                    </div>
                </div>
            </div>
            <div class="col-md-4">
                <div class="card stat-card bg-info text-white">
                    <div class="card-body">
                        <h6>عدد الطلبات</h6>
                        <h3>${data.totalOrders}</h3>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="card">
            <div class="card-body">
                <canvas id="reportChart" height="100"></canvas>
            </div>
        </div>
    `;
    
    // Create chart
    createReportChart(data);
}

function createReportChart(data) {
    const ctx = document.getElementById('reportChart').getContext('2d');
    
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['المبيعات', 'الأرباح'],
            datasets: [{
                label: 'القيم المالية',
                data: [data.totalSales, data.totalProfit],
                backgroundColor: [
                    'rgba(212, 175, 55, 0.8)',
                    'rgba(25, 135, 84, 0.8)'
                ],
                borderColor: [
                    'rgba(212, 175, 55, 1)',
                    'rgba(25, 135, 84, 1)'
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

function exportToExcel() {
    showNotification('جاري التصدير...', 'info');
}

function exportToPDF() {
    showNotification('جاري التصدير...', 'info');
}

// ============================================
// Admin Functions
// ============================================

async function loadAdminData() {
    if (!isAdmin) return;
    
    try {
        // Load users
        const usersSnapshot = await db.collection('users').get();
        document.getElementById('adminTotalUsers').textContent = usersSnapshot.size;
        
        // Load subscriptions
        loadSubscriptions();
        
        // Load operations log
        loadOperationsLog();
        
    } catch (error) {
        console.error('Error loading admin data:', error);
    }
}

async function loadSubscriptions() {
    const snapshot = await db.collection('subscriptions').get();
    
    const container = document.getElementById('packagesList');
    container.innerHTML = snapshot.docs.map(doc => {
        const sub = doc.data();
        return `
            <div class="col-md-4">
                <div class="card h-100">
                    <div class="card-header bg-white text-center">
                        <h4 class="text-gold">${sub.name}</h4>
                        <h3>${formatCurrency(sub.price)}/${sub.period}</h3>
                    </div>
                    <div class="card-body">
                        <ul class="list-unstyled">
                            ${sub.features.map(f => `<li><i class="fas fa-check text-success me-2"></i>${f}</li>`).join('')}
                        </ul>
                    </div>
                    <div class="card-footer bg-white">
                        <button class="btn btn-outline-primary w-100" onclick="editSubscription('${doc.id}')">
                            <i class="fas fa-edit"></i> تعديل
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

async function loadOperationsLog() {
    const snapshot = await db.collection('operationsLog')
        .orderBy('timestamp', 'desc')
        .limit(50)
        .get();
    
    const tbody = document.getElementById('operationsTable');
    tbody.innerHTML = snapshot.docs.map(doc => {
        const op = doc.data();
        return `
            <tr>
                <td>${formatDate(op.timestamp)}</td>
                <td>${op.userName}</td>
                <td>${op.type}</td>
                <td>${op.details}</td>
                <td><small>${JSON.stringify(op.request).substring(0, 50)}...</small></td>
                <td><small>${JSON.stringify(op.response).substring(0, 50)}...</small></td>
                <td><span class="badge ${op.success ? 'badge-success' : 'badge-danger'}">${op.success ? 'ناجح' : 'فشل'}</span></td>
            </tr>
        `;
    }).join('');
}

// ============================================
// Utility Functions
// ============================================

function formatCurrency(amount, currency = 'SAR') {
    const currencies = {
        'SAR': { symbol: 'ر.س', rate: 1 },
        'USD': { symbol: '$', rate: 3.75 },
        'EUR': { symbol: '€', rate: 4.05 }
    };
    
    const curr = currencies[currency] || currencies['SAR'];
    const converted = amount * curr.rate;
    
    return `${converted.toFixed(2)} ${curr.symbol}`;
}

function formatDate(timestamp) {
    if (!timestamp) return '-';
    
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('ar-SA', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

function getStatusBadge(status) {
    const badges = {
        'active': 'badge-success',
        'inactive': 'badge-warning',
        'blocked': 'badge-danger',
        'pending': 'badge-warning',
        'sold': 'badge-success',
        'cancelled': 'badge-danger'
    };
    return badges[status] || 'badge-info';
}

function getStatusText(status) {
    const texts = {
        'active': 'نشط',
        'inactive': 'غير نشط',
        'blocked': 'محظور',
        'pending': 'قيد المعالجة',
        'sold': 'تم البيع',
        'cancelled': 'ملغي'
    };
    return texts[status] || status;
}

function getStoreName(store) {
    const stores = {
        'shein': 'SHEIN',
        'temu': 'TEMU',
        'amazon': 'AMAZON'
    };
    return stores[store] || store;
}

function getCountryName(code) {
    const countries = {
        'SA': 'السعودية',
        'AE': 'الإمارات',
        'EG': 'مصر',
        'KW': 'الكويت',
        'QA': 'قطر',
        'BH': 'البحرين',
        'OM': 'عمان'
    };
    return countries[code] || code;
}

function showNotification(message, type = 'info') {
    const colors = {
        'success': '#198754',
        'error': '#dc3545',
        'warning': '#ffc107',
        'info': '#0dcaf0'
    };
    
    const notification = document.createElement('div');
    notification.className = 'alert alert-dismissible fade show position-fixed';
    notification.style.cssText = `
        top: 20px;
        left: 20px;
        z-index: 9999;
        background: ${colors[type]};
        color: white;
        min-width: 300px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    `;
    notification.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 5000);
}

function showLoading(show) {
    if (show) {
        const overlay = document.createElement('div');
        overlay.className = 'spinner-overlay';
        overlay.id = 'loadingOverlay';
        overlay.innerHTML = `
            <div class="spinner-border spinner-border-gold" style="width: 3rem; height: 3rem;" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
        `;
        document.body.appendChild(overlay);
    } else {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) overlay.remove();
    }
}

// ============================================
// Initialize on DOM Ready
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('Meraj SaaS initialized');
});
