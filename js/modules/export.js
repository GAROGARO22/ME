import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

/**
 * وحدة تصدير التقارير إلى PDF و Excel
 */

/**
 * تصدير جدول إلى PDF
 * @param {Array} columns - أعمدة الجدول
 * @param {Array} data - بيانات الجدول
 * @param {String} title - عنوان التقرير
 * @param {String} filename - اسم الملف
 */
export function exportToPDF(columns, data, title = 'تقرير', filename = 'report.pdf') {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  // إضافة العنوان باللغة العربية (يتطلب خط عربي)
  doc.setFontSize(18);
  doc.text(title, 14, 20);

  // تحويل الأعمدة للصيغة المناسبة
  const columnHeaders = columns.map(col => col.header || col);

  // رسم الجدول
  doc.autoTable({
    head: [columnHeaders],
    body: data,
    startY: 30,
    theme: 'grid',
    headStyles: { fillColor: [212, 175, 55] }, // اللون الذهبي
    styles: {
      font: 'helvetica',
      fontSize: 10,
      cellPadding: 3,
      halign: 'right',
      direction: 'rtl'
    }
  });

  // حفظ الملف
  doc.save(filename);
}

/**
 * تصدير جدول إلى Excel (CSV)
 * @param {Array} columns - أعمدة الجدول
 * @param {Array} data - بيانات الجدول
 * @param {String} filename - اسم الملف
 */
export function exportToExcel(columns, data, filename = 'report.csv') {
  // تحويل الأعمدة للصيغة المناسبة
  const columnHeaders = columns.map(col => col.header || col);

  // إنشاء محتوى CSV
  let csvContent = '\uFEFF'; // BOM لدعم اللغة العربية
  
  // إضافة الأعمدة
  csvContent += columnHeaders.join(',') + '\n';
  
  // إضافة البيانات
  data.forEach(row => {
    const escapedRow = row.map(cell => {
      const strCell = String(cell || '');
      // إذا كانت الخلية تحتوي على فاصلة أو علامات اقتباس، نحتاج لتغليفها
      if (strCell.includes(',') || strCell.includes('"') || strCell.includes('\n')) {
        return '"' + strCell.replace(/"/g, '""') + '"';
      }
      return strCell;
    });
    csvContent += escapedRow.join(',') + '\n';
  });

  // إنشاء Blob وتنزيل الملف
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * تصدير بيانات التقارير بتنسيق متقدم
 * @param {Object} reportData - بيانات التقرير الشاملة
 * @param {String} type - نوع التصدير (pdf أو excel)
 * @param {String} filename - اسم الملف
 */
export function exportReport(reportData, type = 'pdf', filename = 'report') {
  const { columns, data, title, summary } = reportData;

  if (type === 'pdf') {
    exportToPDF(columns, data, title, `${filename}.pdf`);
  } else if (type === 'excel') {
    exportToExcel(columns, data, `${filename}.csv`);
  }
}

/**
 * إنشاء ملخص تقرير
 * @param {Array} data - البيانات
 * @returns {Object} ملخص الإحصائيات
 */
export function generateReportSummary(data) {
  if (!data || data.length === 0) {
    return {
      totalRecords: 0,
      totalValue: 0,
      averageValue: 0
    };
  }

  const totalRecords = data.length;
  const totalValue = data.reduce((sum, item) => {
    const value = parseFloat(item.value || item.amount || item.price || 0);
    return sum + value;
  }, 0);
  const averageValue = totalValue / totalRecords;

  return {
    totalRecords,
    totalValue,
    averageValue
  };
}

export default {
  exportToPDF,
  exportToExcel,
  exportReport,
  generateReportSummary
};
