# دليل تكامل جيميل - معراج

## نظرة عامة
تم إضافة نظام كامل لجلب الطلبات تلقائياً من Gmail باستخدام Google OAuth 2.0 و Gmail API.

## المكونات المضافة

### 1. Cloud Functions (`/functions/index.js`)
وظائف سحابية لمعالجة:
- `exchangeToken`: تبادل رمز التفويض مع رموز الوصول
- `fetchGmailOrders`: جلب الإيميلات واستخراج الطلبات
- `disconnectGmail`: فصل حساب جيميل
- `scheduledEmailSync`: مزامنة تلقائية كل ساعة

### 2. وحدة الجافاسكريبت (`/js/gmailIntegration.js`)
واجهة أمامية للتعامل مع:
- توليد رابط المصادقة
- تبادل الرموز
- جلب الطلبات
- التحقق من حالة الاتصال

### 3. صفحة الاستدعاء (`/gmail-callback.html`)
صفحة معالجة العودة من Google OAuth مع:
- واجهة احترافية تعرض حالة الربط
- معالجة الأخطاء
- إعادة توجيه تلقائية

## خطوات التفعيل

### 1. إعداد Google Cloud Console

1. اذهب إلى [Google Cloud Console](https://console.cloud.google.com/)
2. أنشئ مشروع جديد أو اختر مشروع موجود
3. فعّل Gmail API:
   - اذهب إلى "APIs & Services" > "Library"
   - ابحث عن "Gmail API" وفعلّه

4. إنشاء بيانات اعتماد OAuth:
   - اذهب إلى "APIs & Services" > "Credentials"
   - انقر "Create Credentials" > "OAuth client ID"
   - اختر "Web application"
   - أضف URI إعادة التوجيه: `https://YOUR_DOMAIN.com/gmail-callback.html`
   - احفظ Client ID و Client Secret

### 2. تكوين Firebase

1. تثبيت dependencies:
```bash
cd functions
npm install
```

2. إضافة متغيرات البيئة:
```bash
firebase functions:config:set \
  gmail.client_id="YOUR_CLIENT_ID" \
  gmail.client_secret="YOUR_CLIENT_SECRET" \
  gmail.redirect_uri="https://YOUR_DOMAIN.com/gmail-callback.html"
```

أو محلياً للتطوير:
```bash
export GMAIL_CLIENT_ID="your_client_id"
export GMAIL_CLIENT_SECRET="your_client_secret"
export GMAIL_REDIRECT_URI="http://localhost:3000/gmail-callback.html"
```

3. نشر الدوال السحابية:
```bash
firebase deploy --only functions
```

### 3. تحديث الواجهة الأمامية

في ملف `/js/gmailIntegration.js`:
```javascript
this.CLIENT_ID = "YOUR_ACTUAL_CLIENT_ID"; // استبدل بـ Client ID الحقيقي
```

في ملف `/gmail-callback.html`:
```javascript
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    // ... بقية الإعدادات
};
```

### 4. استخدام الميزة في التطبيق

#### بدء عملية الربط:
```javascript
import { gmailIntegration } from './js/gmailIntegration.js';

// عند النقر على زر "ربط جيميل"
gmailIntegration.startOAuthFlow();
```

#### جلب الطلبات يدوياً:
```javascript
const result = await gmailIntegration.fetchOrders(50);
if (result.success) {
    console.log(`تم جلب ${result.data.count} طلب جديد`);
    console.log(result.data.orders);
} else {
    console.error(result.error);
}
```

#### التحقق من حالة الاتصال:
```javascript
const isConnected = await gmailIntegration.isConnected();
if (isConnected) {
    const lastSync = await gmailIntegration.getLastSyncTime();
    console.log('آخر مزامنة:', gmailIntegration.formatDate(lastSync));
}
```

#### فصل الحساب:
```javascript
const result = await gmailIntegration.disconnect();
if (result.success) {
    console.log('تم فصل الحساب بنجاح');
}
```

## استخراج البيانات من الإيميلات

النظام يستخدم تعابير نمطية (Regex) لاستخراج:
- رقم الطلب
- اسم العميل
- البريد الإلكتروني
- رقم الهاتف (تنسيق سعودي)
- المبلغ الإجمالي
- العملة

### تخصيص أنماط الاستخراج

في `/functions/index.js`، عدّل الدالة `extractOrderFromEmail`:

```javascript
// إضافة أنماط جديدة
const customPatterns = [
    /نمط_جديد[:\s]+([قيمة])/i
];
```

## المزامنة التلقائية

الدالة `scheduledEmailSync` تعمل كل ساعة تلقائياً لـ:
- جلب الإيميلات الجديدة من جميع المستخدمين المتصلين
- استخراج الطلبات وحفظها في قاعدة البيانات
- تحديث وقت آخر مزامنة

## معالجة الأخطاء

### أخطاء شائعة:

1. **انتهت صلاحية الرموز**
   - الحل: النظام يعيد التحديث تلقائياً
   - إذا فشل: يطلب من المستخدم إعادة الربط

2. **لا توجد صلاحيات كافية**
   - تأكد من طلب الصلاحيات الصحيحة في `SCOPES`

3. **حدود API**
   - Gmail API له حدود استخدام يومية
   - راقب الاستخدام في Google Cloud Console

## قواعد البيانات

### مجموعة `users`:
```javascript
{
    gmailConnected: boolean,
    gmailTokens: {
        accessToken: string,
        refreshToken: string,
        expiryDate: number,
        scope: string,
        tokenType: string,
        updatedAt: timestamp
    },
    lastSyncAt: timestamp,
    totalOrdersSynced: number,
    syncError?: string
}
```

### مجموعة `orders`:
```javascript
{
    gmailMessageId: string,
    userId: string,
    source: "gmail",
    customerName: string,
    customerEmail: string,
    customerPhone: string,
    orderNumber: string,
    totalAmount: number,
    currency: string,
    status: "pending",
    rawEmail: {
        from: string,
        to: string,
        subject: string,
        date: string,
        headers: array
    },
    createdAt: timestamp
}
```

## الاختبار المحلي

1. تشغيل الخادم المحلي:
```bash
npm run dev
```

2. محاكاة الدوال السحابية:
```bash
cd functions
npm run serve
```

3. اختبر التدفق الكامل:
   - انقر "ربط جيميل"
   - وافق على الصلاحيات
   - تحقق من صفحة الاستدعاء
   - اضغط "جلب الطلبات"

## الأمان

- الرموز مخزنة بشكل آمن في Firestore
- استخدام Refresh Tokens للوصول المستمر
- التحقق من مصادقة المستخدم في كل دالة
- عدم تعريض Client Secret في الكود الأمامي

## الدعم

للمساعدة أو الإبلاغ عن مشاكل:
- راجع سجلات الدوال: `firebase functions:log`
- تحقق من Google Cloud Console للأخطاء
- تأكد من صحة إعدادات OAuth
