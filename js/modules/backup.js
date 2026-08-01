/**
 * وحدة النسخ الاحتياطي والاستعادة
 */

import { exportToExcel } from './export.js';

/**
 * إنشاء نسخة احتياطية من جميع البيانات
 * @param {Object} db - مثيل Firestore
 * @param {String} userId - معرف المستخدم
 * @returns {Promise<Object>} بيانات النسخة الاحتياطية
 */
export async function createBackup(db, userId) {
  const backupData = {
    metadata: {
      createdAt: new Date().toISOString(),
      userId: userId,
      version: '1.0'
    },
    collections: {}
  };

  const collections = ['customers', 'orders', 'settings', 'emailConfigs'];

  for (const collection of collections) {
    try {
      const snapshot = await db.collection(collection)
        .where('userId', '==', userId)
        .get();

      const docs = [];
      snapshot.forEach(doc => {
        docs.push({
          id: doc.id,
          data: doc.data()
        });
      });

      backupData.collections[collection] = docs;
    } catch (error) {
      console.error(`Error backing up ${collection}:`, error);
      backupData.collections[collection] = [];
    }
  }

  return backupData;
}

/**
 * تنزيل النسخة الاحتياطية كملف JSON
 * @param {Object} backupData - بيانات النسخة الاحتياطية
 * @param {String} filename - اسم الملف
 */
export function downloadBackup(backupData, filename = 'backup.json') {
  const jsonString = JSON.stringify(backupData, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * استعادة البيانات من نسخة احتياطية
 * @param {Object} db - مثيل Firestore
 * @param {Object} backupData - بيانات النسخة الاحتياطية
 * @param {String} userId - معرف المستخدم
 * @param {Function} onProgress - دالة تتبع التقدم (اختياري)
 * @returns {Promise<Object>} نتيجة الاستعادة
 */
export async function restoreBackup(db, backupData, userId, onProgress = null) {
  const result = {
    success: true,
    restored: {},
    errors: []
  };

  if (!backupData || !backupData.collections) {
    result.success = false;
    result.errors.push('بيانات النسخة الاحتياطية غير صالحة');
    return result;
  }

  const batch = db.batch();
  let operationCount = 0;
  const totalOperations = Object.values(backupData.collections).reduce((sum, arr) => sum + arr.length, 0);

  for (const [collectionName, docs] of Object.entries(backupData.collections)) {
    result.restored[collectionName] = 0;

    for (const doc of docs) {
      try {
        const docRef = db.collection(collectionName).doc();
        const data = {
          ...doc.data,
          userId: userId,
          restoredAt: new Date()
        };

        batch.set(docRef, data);
        operationCount++;

        if (onProgress) {
          onProgress(operationCount, totalOperations);
        }

        // تنفيذ كل 500 عملية (حد Firebase للـ batch)
        if (operationCount % 500 === 0) {
          await batch.commit();
          result.restored[collectionName] += 500;
        }
      } catch (error) {
        console.error(`Error restoring document:`, error);
        result.errors.push(`Failed to restore ${collectionName}/${doc.id}: ${error.message}`);
      }
    }
  }

  // تنفيذ العمليات المتبقية
  if (operationCount % 500 !== 0) {
    try {
      await batch.commit();
      const remaining = operationCount % 500;
      const lastCollection = Object.keys(backupData.collections).pop();
      result.restored[lastCollection] += remaining;
    } catch (error) {
      result.success = false;
      result.errors.push(`Failed to commit final batch: ${error.message}`);
    }
  }

  return result;
}

/**
 * قراءة ملف النسخة الاحتياطية
 * @param {File} file - ملف النسخة الاحتياطية
 * @returns {Promise<Object>} بيانات النسخة الاحتياطية
 */
export function readBackupFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        resolve(data);
      } catch (error) {
        reject(new Error('ملف النسخة الاحتياطية غير صالح'));
      }
    };
    
    reader.onerror = () => {
      reject(new Error('فشل قراءة الملف'));
    };
    
    reader.readAsText(file);
  });
}

/**
 * تصدير النسخة الاحتياطية إلى Excel
 * @param {Object} backupData - بيانات النسخة الاحتياطية
 * @param {String} collectionName - اسم المجموعة للتصدير
 */
export function exportBackupToExcel(backupData, collectionName) {
  if (!backupData.collections[collectionName]) {
    console.error(`Collection ${collectionName} not found in backup`);
    return;
  }

  const docs = backupData.collections[collectionName];
  if (docs.length === 0) {
    console.warn('No data to export');
    return;
  }

  // استخراج الأعمدة من أول وثيقة
  const firstDoc = docs[0].data;
  const columns = Object.keys(firstDoc).map(key => ({
    header: key,
    key: key
  }));

  // تحويل البيانات لتنسيق الصفوف
  const data = docs.map(doc => 
    columns.map(col => doc.data[col.key] || '')
  );

  exportToExcel(columns, data, `backup_${collectionName}_${new Date().toISOString().split('T')[0]}.csv`);
}

/**
 * التحقق من صحة النسخة الاحتياطية
 * @param {Object} backupData - بيانات النسخة الاحتياطية
 * @returns {Object} نتيجة التحقق
 */
export function validateBackup(backupData) {
  const result = {
    valid: true,
    errors: [],
    warnings: []
  };

  if (!backupData) {
    result.valid = false;
    result.errors.push('بيانات النسخة الاحتياطية فارغة');
    return result;
  }

  if (!backupData.metadata) {
    result.warnings.push('لا توجد بيانات وصفية للنسخة الاحتياطية');
  } else {
    if (!backupData.metadata.createdAt) {
      result.warnings.push('لا يوجد تاريخ إنشاء للنسخة الاحتياطية');
    }
    if (!backupData.metadata.userId) {
      result.warnings.push('لا يوجد معرف مستخدم للنسخة الاحتياطية');
    }
  }

  if (!backupData.collections || Object.keys(backupData.collections).length === 0) {
    result.valid = false;
    result.errors.push('لا توجد مجموعات في النسخة الاحتياطية');
  }

  return result;
}

export default {
  createBackup,
  downloadBackup,
  restoreBackup,
  readBackupFile,
  exportBackupToExcel,
  validateBackup
};
