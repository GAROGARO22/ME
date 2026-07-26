import { initTheme, toggleTheme } from './modules/theme.js';
import { initNotifications, destroyNotifications } from './modules/notifications.js';
import { initDashboardController } from './controllers/dashboardController.js';
import { initCustomersController } from './controllers/customersController.js';
import { initProfileController } from './controllers/profileController.js';
import { initUsersController } from './controllers/admin/usersController.js';
import { initSubscriptionsController } from './controllers/admin/subscriptionsController.js';
import { initOperationsController } from './controllers/admin/operationsController.js';
import { initSettingsController } from './controllers/admin/settingsController.js';

// ==========================================
// 1. تهيئة إعدادات فايربيس
// ==========================================
const firebase = window.firebase;
const firebaseConfig = {
  apiKey: 'AIzaSyATErm0RWNW9QTgne2lzk4t-HQEIRRitDA',
  authDomain: 'mia3raj.firebaseapp.com',
  projectId: 'mia3raj',
  storageBucket: 'mia3raj.firebasestorage.app',
  messagingSenderId: '618757631405',
  appId: '1:618757631405:web:4deb8767bb84c4e07c0524',
  measurementId: 'G-Z1VQ0GY9C3'
};

if (firebase && !firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

if (!firebase?.auth || !firebase?.firestore) {
  console.error('Firebase Compat SDK missing!');
}

const auth = firebase?.auth ? firebase.auth() : null;
const db = firebase?.firestore ? firebase.firestore() : null;
// ==========================================
let currentUser = null;
let userData = null;
let isAdmin = false;

const app = {
  auth,
  db,
  currentUser,
  userData,
  isAdmin,
  formatCurrency(amount, currency = 'SAR') {
    const currencies = {
      SAR: { symbol: 'ر.س', rate: 1 },
      USD: { symbol: '$', rate: 3.75 },
      EUR: { symbol: '€', rate: 4.05 }
    };
    const curr = currencies[currency] || currencies.SAR;
    const converted = Number(amount || 0) * curr.rate;
    return `${converted.toFixed(2)} ${curr.symbol}`;
  },
  formatDate(timestamp) {
    if (!timestamp) return '-';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' });
  },
  showNotification(message, type = 'info') {
    const colors = { success: '#198754', error: '#dc3545', warning: '#ffc107', info: '#0dcaf0' };
    const notification = document.createElement('div');
    notification.className = 'alert alert-dismissible fade show position-fixed';
    notification.style.cssText = `top:20px;left:20px;z-index:9999;background:${colors[type] || colors.info};color:white;min-width:300px;box-shadow:0 4px 12px rgba(0,0,0,0.15);`;
    notification.innerHTML = `${message}<button type="button" class="btn-close" data-bs-dismiss="alert"></button>`;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 5000);
  }
};

function setAppState(nextUser, nextUserData) {
  currentUser = nextUser;
  userData = nextUserData;
  isAdmin = nextUserData?.role === 'admin';
  app.currentUser = nextUser;
  app.userData = nextUserData;
  app.isAdmin = isAdmin;
}

// ==========================================
// 3. المصادقة والصلاحيات
// ==========================================
function handleGoogleLogin() {
  if (!auth || !firebase?.auth) {
    app.showNotification('تعذر تهيئة Firebase', 'error');
    return;
  }

  const provider = new firebase.auth.GoogleAuthProvider();
  auth.signInWithPopup(provider)
    .then((result) => {
      checkUserPermissions(result.user);
    })
    .catch((error) => {
      if (error.code !== 'auth/cancelled-popup-request' && error.code !== 'auth/popup-closed-by-user') {
        console.error('Login error:', error);
        app.showNotification('خطأ في تسجيل الدخول', 'error');
      }
    });
}

function handleLogout() {
  auth.signOut()
    .then(() => {
      destroyNotifications();
      window.location.reload();
    })
    .catch((error) => {
      console.error('Logout error:', error);
    });
}

async function checkUserPermissions(user) {
  try {
    const userDoc = await db.collection('users').doc(user.uid).get();
    if (userDoc.exists) {
      setAppState(user, userDoc.data());
    } else {
      const newUserData = {
        email: user.email,
        name: user.displayName,
        photoURL: user.photoURL,
        role: 'user',
        subscription: 'free',
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        isActive: true
      };
      await db.collection('users').doc(user.uid).set(newUserData);
      setAppState(user, newUserData);
    }
    initializeApp();
  } catch (error) {
    console.error('Error checking permissions:', error);
    app.showNotification('خطأ في تحميل البيانات', 'error');
  }
}

// ==========================================
// 4. العمليات الأساسية وإضافة البيانات
// ==========================================
function saveCustomer() {
  const form = document.getElementById('addCustomerForm');
  const fields = form?.querySelectorAll('input, select, textarea');
  const values = Array.from(fields || []).map((field) => field.value);
  if (!values.some(Boolean)) {
    app.showNotification('يرجى تعبئة بيانات العميل', 'warning');
    return;
  }

  const customer = {
    userId: currentUser.uid,
    name: values[0] || '',
    phone: values[1] || '',
    email: values[2] || '',
    country: values[3] || '',
    address: values[4] || '',
    status: 'active',
    totalOrders: 0,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  db.collection('customers').add(customer)
    .then(() => {
      app.showNotification('تم إضافة العميل بنجاح', 'success');
      bootstrap.Modal.getInstance(document.getElementById('addCustomerModal'))?.hide();
      if(typeof window.loadCustomers === 'function') window.loadCustomers(); // تحديث الجدول
    })
    .catch((error) => {
      console.error(error);
      app.showNotification('خطأ في الحفظ', 'error');
    });
}

function saveOrder() {
  const form = document.getElementById('addOrderForm');
  const values = Array.from(form?.querySelectorAll('input, select, textarea') || []).map((field) => field.value);
  if (!values.some(Boolean)) {
    app.showNotification('يرجى تعبئة بيانات الطلب', 'warning');
    return;
  }

  const order = {
    userId: currentUser.uid,
    orderNumber: values[0] || '',
    store: values[1] || '',
    productName: values[2] || '',
    purchasePrice: parseFloat(values[3]) || 0,
    currency: values[4] || 'SAR',
    salePrice: parseFloat(values[5]) || 0,
    customerId: values[6] || '',
    status: 'pending',
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  db.collection('orders').add(order)
    .then(() => {
      app.showNotification('تم إضافة الطلب بنجاح', 'success');
      bootstrap.Modal.getInstance(document.getElementById('addOrderModal'))?.hide();
      if(typeof window.loadOrders === 'function') window.loadOrders(); // تحديث الجدول
    })
    .catch((error) => {
      console.error(error);
      app.showNotification('خطأ في الحفظ', 'error');
    });
}

// ==========================================
// 5. التوجيه (Router) وإدارة الواجهة
// ==========================================
function bindGlobalEvents() {
  const logoutButton = document.getElementById('logoutBtn');
  const logoutLink = document.getElementById('logoutLink');
  const connectGoogleButton = document.getElementById('btnConnectGoogle');
  const saveCustomerButton = document.getElementById('saveCustomerBtn');
  const saveOrderButton = document.getElementById('saveOrderBtn');

  logoutButton?.addEventListener('click', (event) => {
    event.preventDefault();
    handleLogout();
  });

  logoutLink?.addEventListener('click', (event) => {
    event.preventDefault();
    handleLogout();
  });

  connectGoogleButton?.addEventListener('click', (event) => {
    event.preventDefault();
    startGoogleAuth();
  });

  saveCustomerButton?.addEventListener('click', (event) => {
    event.preventDefault();
    saveCustomer();
  });

  saveOrderButton?.addEventListener('click', (event) => {
    event.preventDefault();
    saveOrder();
  });
}

function initializeApp() {
  document.getElementById('loginPage').classList.add('d-none');
  document.getElementById('mainApp').classList.remove('d-none');
  document.getElementById('userName').textContent = currentUser.displayName || 'مستخدم';
  if (isAdmin) {
    document.querySelectorAll('.admin-only').forEach((el) => el.classList.remove('d-none'));
  }
  
  initTheme();
  bindGlobalEvents();
  setupSidebar();
  setupRouter();
  initNotifications(app);

  const hasSeenModal = localStorage.getItem('meraj_automation_seen');
  const isGmailConnected = false;
  if (!hasSeenModal && !isGmailConnected) {
    setTimeout(() => {
      const modalEl = document.getElementById('smartAutomationModal');
      if (modalEl) {
        const modal = new bootstrap.Modal(modalEl);
        modal.show();
      }
    }, 5000);
  }

  const smartModal = document.getElementById('smartAutomationModal');
  if (smartModal) {
    smartModal.addEventListener('hidden.bs.modal', function () {
      localStorage.setItem('meraj_automation_seen', 'true');
    }, { once: true });
  }
}

function setupSidebar() {
  document.getElementById('sidebarCollapse')?.addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('active');
    document.getElementById('content').classList.toggle('active');
  });

  document.querySelectorAll('[data-page]').forEach((link) => {
    link.addEventListener('click', async (event) => {
      event.preventDefault();
      const page = event.currentTarget.getAttribute('data-page');
      history.pushState({}, '', `#${page}`);
      await renderRoute(page);
      updateActiveNav(page);
    });
  });
}

function updateActiveNav(page) {
  document.querySelectorAll('.sidebar ul li').forEach((li) => li.classList.remove('active'));
  const activeLink = document.querySelector(`[data-page="${page}"]`);
  if (activeLink?.closest('li')) {
    activeLink.closest('li').classList.add('active');
  }
}

async function ensureAdminAccess() {
  if (!currentUser) return false;
  const userDoc = await db.collection('users').doc(currentUser.uid).get();
  if (!userDoc.exists || userDoc.data().role !== 'admin') {
    const content = document.getElementById('appContent');
    if (content) {
      content.innerHTML = '<div class="alert alert-danger">غير مسموح لك بالوصول إلى هذه الصفحة.</div>';
    }
    return false;
  }
  setAppState(currentUser, userDoc.data());
  return true;
}

async function renderRoute(routeName) {
  const content = document.getElementById('appContent');
  if (!content) return;

  const routes = {
    dashboard: { view: 'views/dashboard.html', controller: initDashboardController },
    customers: { view: 'views/customers.html', controller: initCustomersController },
    orders: { view: 'views/orders.html', controller: null },
    reports: { view: 'views/reports.html', controller: null },
    profile: { view: 'views/profile.html', controller: initProfileController },
    admin: { view: 'views/admin/users.html', controller: initUsersController }
  };

  const normalizedPage = routeName || 'dashboard';
  const route = routes[normalizedPage] || routes.dashboard;

  if (normalizedPage === 'admin' && !(await ensureAdminAccess())) {
    return;
  }

  try {
    const response = await fetch(route.view);
    if (!response.ok) {
      throw new Error(`Failed to load ${route.view}`);
    }
    const html = await response.text();
    content.innerHTML = html;

    if (route.controller) {
      route.controller({ app });
    }

    if (normalizedPage === 'admin') {
      initSubscriptionsController({ app });
      initOperationsController({ app });
      initSettingsController({ app });
    }
  } catch (error) {
    console.error('Route load error:', error);
    content.innerHTML = '<div class="alert alert-danger">تعذر تحميل الصفحة.</div>';
  }
}

function setupRouter() {
  const initialPage = window.location.hash.replace('#', '') || 'dashboard';
  renderRoute(initialPage);
  window.addEventListener('popstate', () => {
    const page = window.location.hash.replace('#', '') || 'dashboard';
    renderRoute(page);
  });
}

// ==========================================
// 6. دوال الأتمتة وجلب البيانات الأساسية (تم إصلاحها)
// ==========================================
function startGoogleAuth() {
    if (!currentUser) {
        app.showNotification("يرجى تسجيل الدخول أولاً", "error");
        return;
    }
    const btn = document.getElementById('btnConnectGoogle');
    if(btn) {
        btn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i> جاري التحويل...';
        btn.disabled = true;
    }
    // التوجيه الفعلي لخادم Vercel الذي برمجناه
    window.location.href = `/api/google-auth?uid=${currentUser.uid}`;
}

// هذه الدوال تمنع رسائل الخطأ الحمراء في المتصفح وتجلب البيانات حسب صلاحيات القواعد
window.loadCustomers = async function() {
    if (!currentUser) return;
    try {
        const snapshot = await db.collection('customers').where('userId', '==', currentUser.uid).get();
        console.log("تم سحب العملاء بنجاح، العدد:", snapshot.size);
    } catch (error) {
        console.error("خطأ في جلب العملاء:", error);
    }
};

window.loadOrders = async function() {
    if (!currentUser) return;
    try {
        const snapshot = await db.collection('orders').where('userId', '==', currentUser.uid).get();
        console.log("تم سحب الطلبات بنجاح، العدد:", snapshot.size);
    } catch (error) {
        console.error("خطأ في جلب الطلبات:", error);
    }
};

// ==========================================
// 7. دوال وهمية لإيقاف أخطاء الـ Console لحين برمجتها لاحقاً
// ==========================================
window.addCurrency = () => app.showNotification("سيتم تفعيل ميزة إضافة العملات قريباً", "info");
window.editCustomer = (id) => app.showNotification("جاري برمجة نافذة تعديل العميل", "info");
window.deleteCustomer = (id) => app.showNotification("جاري برمجة ميزة الحذف", "info");
window.editOrder = (id) => app.showNotification("جاري برمجة نافذة تعديل الطلب", "info");
window.linkCustomer = (id) => app.showNotification("جاري برمجة ميزة الربط", "info");
window.deleteOrder = (id) => app.showNotification("جاري برمجة ميزة الحذف", "info");
window.editSubscription = (id) => app.showNotification("سيتم تفعيل تعديل الاشتراكات قريباً", "info");
window.filterOrders = () => console.log("Filtering orders...");
window.filterCustomers = () => console.log("Filtering customers...");
window.syncEmails = () => app.showNotification('جاري فحص البريد للطلبات الجديدة...', 'info');

// ==========================================
// 8. التهيئة عند تحميل الصفحة
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  // تم إزالة مستمع تسجيل الدخول من هنا لمنع التعارض مع كود index.html
  const params = new URLSearchParams(window.location.search);
  const syncStatus = params.get('sync');
  if (syncStatus === 'success') {
    setTimeout(() => app.showNotification('تم ربط حساب Google بنجاح وتفعيل الأتمتة', 'success'), 1000);
    window.history.replaceState({}, document.title, window.location.pathname);
  }
});

// تصدير الدوال الضرورية للواجهة الأمامية (Global Scope)
window.handleGoogleLogin = handleGoogleLogin;
window.handleLogout = handleLogout;
window.toggleTheme = toggleTheme;
window.saveCustomer = saveCustomer;
window.saveOrder = saveOrder;
window.startGoogleAuth = startGoogleAuth;
window.app = app;
window.checkUserPermissions = checkUserPermissions;