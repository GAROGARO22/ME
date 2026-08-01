/**
 * وحدة التحقق من صحة البيانات
 */

/**
 * التحقق من صحة البريد الإلكتروني
 * @param {String} email - البريد الإلكتروني
 * @returns {Boolean} النتيجة
 */
export function isValidEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

/**
 * التحقق من صحة رقم الهاتف (دولي)
 * @param {String} phone - رقم الهاتف
 * @returns {Boolean} النتيجة
 */
export function isValidPhone(phone) {
  const re = /^[\+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,9}$/;
  return re.test(phone.replace(/\s/g, ''));
}

/**
 * التحقق من صحة رقم الهاتف السعودي
 * @param {String} phone - رقم الهاتف
 * @returns {Boolean} النتيجة
 */
export function isValidSaudiPhone(phone) {
  const re = /^(\+966|0)?5[0-9]{8}$/;
  return re.test(phone.replace(/\s/g, ''));
}

/**
 * التحقق من قوة كلمة المرور
 * @param {String} password - كلمة المرور
 * @returns {Object} نتيجة التحقق مع التفاصيل
 */
export function validatePassword(password) {
  const result = {
    valid: false,
    errors: [],
    strength: 'weak'
  };

  if (!password || password.length < 8) {
    result.errors.push('كلمة المرور يجب أن تكون 8 أحرف على الأقل');
  }

  if (!/[A-Z]/.test(password)) {
    result.errors.push('كلمة المرور يجب أن تحتوي على حرف كبير واحد على الأقل');
  }

  if (!/[a-z]/.test(password)) {
    result.errors.push('كلمة المرور يجب أن تحتوي على حرف صغير واحد على الأقل');
  }

  if (!/[0-9]/.test(password)) {
    result.errors.push('كلمة المرور يجب أن تحتوي على رقم واحد على الأقل');
  }

  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    result.errors.push('كلمة المرور يجب أن تحتوي على رمز خاص واحد على الأقل');
  }

  if (result.errors.length === 0) {
    result.valid = true;
    if (password.length >= 12 && /[A-Z]/.test(password) && /[a-z]/.test(password) && /[0-9]/.test(password) && /[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      result.strength = 'strong';
    } else {
      result.strength = 'medium';
    }
  }

  return result;
}

/**
 * التحقق من صحة الرقم الوطني السعودي
 * @param {String} nationalId - الرقم الوطني
 * @returns {Boolean} النتيجة
 */
export function isValidSaudiNationalId(nationalId) {
  if (!/^[0-9]{10}$/.test(nationalId)) {
    return false;
  }

  const id = nationalId.split('').map(Number);
  
  // التحقق من الخوارزمية
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    let digit = id[i];
    if (i % 2 === 0) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }
    sum += digit;
  }

  return sum % 10 === 0;
}

/**
 * التحقق من صحة التاريخ
 * @param {String} dateStr - التاريخ بصيغة YYYY-MM-DD
 * @returns {Boolean} النتيجة
 */
export function isValidDate(dateStr) {
  const date = new Date(dateStr);
  return date instanceof Date && !isNaN(date);
}

/**
 * التحقق من أن التاريخ في المستقبل
 * @param {String} dateStr - التاريخ
 * @returns {Boolean} النتيجة
 */
export function isFutureDate(dateStr) {
  const date = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date > today;
}

/**
 * التحقق من صحة المبلغ المالي
 * @param {Number} amount - المبلغ
 * @param {Number} min - الحد الأدنى (اختياري)
 * @param {Number} max - الحد الأقصى (اختياري)
 * @returns {Boolean} النتيجة
 */
export function isValidAmount(amount, min = 0, max = Infinity) {
  const num = parseFloat(amount);
  return !isNaN(num) && num >= min && num <= max;
}

/**
 * تنظيف النص من الأحرف الخاصة
 * @param {String} text - النص
 * @returns {String} النص المنظف
 */
export function sanitizeText(text) {
  if (!text) return '';
  return text
    .replace(/[<>]/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+=/gi, '')
    .trim();
}

/**
 * التحقق من صحة النموذج
 * @param {Object} formData - بيانات النموذج
 * @param {Array} rules - قواعد التحقق
 * @returns {Object} نتيجة التحقق
 */
export function validateForm(formData, rules) {
  const errors = {};
  const isValid = true;

  rules.forEach(rule => {
    const { field, required, type, minLength, maxLength, pattern, custom } = rule;
    const value = formData[field];

    // التحقق من الحقل المطلوب
    if (required && (!value || value.toString().trim() === '')) {
      errors[field] = `${field} مطلوب`;
      return;
    }

    if (value) {
      // التحقق من النوع
      if (type === 'email' && !isValidEmail(value)) {
        errors[field] = 'البريد الإلكتروني غير صالح';
      }

      if (type === 'phone' && !isValidPhone(value)) {
        errors[field] = 'رقم الهاتف غير صالح';
      }

      if (type === 'number' && isNaN(parseFloat(value))) {
        errors[field] = 'يجب إدخال رقم صحيح';
      }

      if (type === 'date' && !isValidDate(value)) {
        errors[field] = 'التاريخ غير صالح';
      }

      // التحقق من الطول
      if (minLength && value.length < minLength) {
        errors[field] = `الحد الأدنى ${minLength} أحرف`;
      }

      if (maxLength && value.length > maxLength) {
        errors[field] = `الحد الأقصى ${maxLength} حرف`;
      }

      // التحقق من النمط
      if (pattern && !pattern.test(value)) {
        errors[field] = 'الصيغة غير صحيحة';
      }

      // تحقق مخصص
      if (custom && typeof custom === 'function') {
        const customResult = custom(value, formData);
        if (customResult !== true) {
          errors[field] = customResult || 'تحقق غير صالح';
        }
      }
    }
  });

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

export default {
  isValidEmail,
  isValidPhone,
  isValidSaudiPhone,
  validatePassword,
  isValidSaudiNationalId,
  isValidDate,
  isFutureDate,
  isValidAmount,
  sanitizeText,
  validateForm
};
