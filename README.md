# معراج - Meraj SaaS

نظام إدارة المبيعات المتكامل للأشخاص الذين يعملون كبائعين من خلال التسويق الاجتماعي لمنتجات المتاجر الإلكترونية مثل SHEIN و TEMU و AMAZON.

## 🚀 المميزات الرئيسية

### للمستخدمين (البائعين)
- **لوحة تحكم احترافية**: مؤشرات مالية وعملياتية شاملة
- **إدارة العملاء**: إضافة، تعديل، حذف، وتتبع العملاء
- **إدارة الطلبات**: 
  - مزامنة تلقائية من البريد الإلكتروني (Gmail)
  - استيراد طلبات SHEIN تلقائياً من noreply@sheinnotice.com
  - ربط المنتجات بالعملاء
  - تتبع أسعار البيع والشراء
- **التقارير**: 
  - تقارير مفصلة حسب العملاء، الطلبات، التواريخ، المتاجر
  - حساب الأرباح تلقائياً (سعر البيع - سعر الشراء)
  - تحويل العملات بناءً على أسعار الصرف
  - تصدير Excel و PDF

### لمدير النظام
- **لوحة تحكم إدارية متكاملة**
- **إدارة المشتركين**: عرض، تعديل، حذف، تعليق
- **إدارة العمليات**: مراقبة جميع العمليات مع Request/Response
- **إدارة الاشتراكات**: إضافة وتعديل الباقات والصلاحيات
- **إعدادات التطبيق**: 
  - إدارة المستخدمين والصلاحيات
  - إعدادات العملات واللغات والبلدان
  - أسعار صرف العملات

## 🛠️ التقنيات المستخدمة

- **الواجهة الأمامية**: HTML5, CSS3, JavaScript (Vanilla)
- **إطار CSS**: Bootstrap 5 RTL
- **الأيقونات**: Font Awesome 6
- **الرسوم البيانية**: Chart.js
- **الخلفية**: Firebase
  - Firebase Authentication (Google Sign-in)
  - Firestore Database
  - Firebase Hosting (اختياري)
- **الاستضافة**: Vercel

## 🎨 التصميم

- **اللون الرئيسي**: الأسود
- **اللون الثانوي**: الذهبي
- **النمط**: احترافي شركات
- **اللغة**: العربية (RTL)
- **متجاوب**: نعم (Responsive)

## 📁 هيكل المشروع

```
meraj-saas/
├── index.html          # الصفحة الرئيسية والتطبيق
├── css/
│   └── style.css      # التنسيقات والتصميم
├── js/
│   └── app.js         # منطق التطبيق وFirebase
├── assets/            # الصور والملفات الثابتة
├── package.json       # ملف المشروع
└── README.md          # هذا الملف
```

## 🔧 الإعداد والاستخدام

### 1. إعداد Firebase

1. أنشئ مشروعاً جديداً على [Firebase Console](https://console.firebase.google.com/)
2. فعّل الخدمات التالية:
   - Authentication (مع تفعيل Google Sign-in)
   - Firestore Database
3. انسخ إعدادات Firebase من لوحة التحكم

### 2. تحديث ملف `js/app.js`

افتح الملف واستبدل القيم التالية بإعدادات مشروعك:

```javascript
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};
```

### 3. إنشاء قواعد البيانات في Firestore

أنشئ المجموعات (Collections) التالية:

- `users` - بيانات المستخدمين
- `customers` - بيانات عملاء البائعين
- `orders` - الطلبات والمنتجات
- `subscriptions` - باقات الاشتراك
- `emailConfigs` - إعدادات البريد للمزامنة
- `operationsLog` - سجل العمليات
- `settings` - إعدادات التطبيق

### 4. التشغيل المحلي

```bash
# تثبيت live-server (اختياري)
npm install -g live-server

# تشغيل التطبيق محلياً
npm run dev
```

أو ببساطة افتح ملف `index.html` في المتصفح.

### 5. النشر على Vercel

```bash
# تثبيت Vercel CLI
npm install -g vercel

# رفع المشروع
vercel --prod
```

أو اربط مستودع GitHub الخاص بك بـ Vercel للنشر التلقائي.

## 🔐 ميزات الأمان

- مصادقة عبر جوجل فقط
- فصل صلاحيات المستخدمين عن المدير
- حماية قواعد بيانات Firestore بقواعد أمان
- تشفير كلمات مرور التطبيقات (للبريد)

## 📊 هيكل البيانات المقترح

### users
```javascript
{
  email: string,
  name: string,
  photoURL: string,
  role: 'user' | 'admin',
  subscription: 'free' | 'basic' | 'premium',
  createdAt: timestamp,
  isActive: boolean
}
```

### customers
```javascript
{
  userId: string,
  name: string,
  phone: string,
  email: string,
  country: string,
  address: string,
  status: 'active' | 'inactive' | 'blocked',
  totalOrders: number,
  createdAt: timestamp
}
```

### orders
```javascript
{
  userId: string,
  orderNumber: string,
  store: 'shein' | 'temu' | 'amazon',
  productName: string,
  purchasePrice: number,
  salePrice: number,
  currency: 'SAR' | 'USD' | 'EUR',
  customerId: string,
  customerName: string,
  status: 'pending' | 'sold' | 'cancelled',
  createdAt: timestamp
}
```

## 📧 مزامنة Gmail

لتفعيل مزامنة الطلبات من Gmail:

1. انتقل إلى إعدادات حساب جوجل
2. فعّل التحقق بخطوتين
3. أنشئ كلمة مرور للتطبيق (App Password)
4. أدخل البريد وكلمة المرور في إعدادات التطبيق

**ملاحظة**: المزامنة التلقائية تتطلب Cloud Function في Firebase لمعالجة API الخاص بـ Gmail.

## 📄 الترخيص

MIT License

## 👥 الدعم

للدعم الفني والاستفسارات، يرجى التواصل عبر البريد الإلكتروني.

---

**معراج** © 2024 - جميع الحقوق محفوظة
