/**
 * اختبار وحدات التحقق من البيانات
 */

import { describe, it, expect } from '@jest/globals';
import {
  isValidEmail,
  isValidPhone,
  isValidSaudiPhone,
  validatePassword,
  isValidDate,
  isValidAmount,
  sanitizeText
} from '../modules/validation.js';

describe('Validation Module', () => {
  describe('isValidEmail', () => {
    it('should return true for valid emails', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('user.name@domain.co.uk')).toBe(true);
    });

    it('should return false for invalid emails', () => {
      expect(isValidEmail('invalid')).toBe(false);
      expect(isValidEmail('test@')).toBe(false);
      expect(isValidEmail('@example.com')).toBe(false);
    });
  });

  describe('isValidPhone', () => {
    it('should return true for valid phone numbers', () => {
      expect(isValidPhone('+1234567890')).toBe(true);
      expect(isValidPhone('123-456-7890')).toBe(true);
    });

    it('should return false for invalid phone numbers', () => {
      expect(isValidPhone('abc')).toBe(false);
      expect(isValidPhone('123')).toBe(false);
    });
  });

  describe('isValidSaudiPhone', () => {
    it('should return true for valid Saudi phone numbers', () => {
      expect(isValidSaudiPhone('0501234567')).toBe(true);
      expect(isValidSaudiPhone('+966501234567')).toBe(true);
      expect(isValidSaudiPhone('501234567')).toBe(true);
    });

    it('should return false for invalid Saudi phone numbers', () => {
      expect(isValidSaudiPhone('050123456')).toBe(false);
      expect(isValidSaudiPhone('0601234567')).toBe(false);
    });
  });

  describe('validatePassword', () => {
    it('should return valid for strong passwords', () => {
      const result = validatePassword('StrongP@ss123');
      expect(result.valid).toBe(true);
    });

    it('should return invalid for weak passwords', () => {
      const result = validatePassword('weak');
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('isValidDate', () => {
    it('should return true for valid dates', () => {
      expect(isValidDate('2024-01-01')).toBe(true);
      expect(isValidDate('2024-12-31')).toBe(true);
    });

    it('should return false for invalid dates', () => {
      expect(isValidDate('invalid')).toBe(false);
      expect(isValidDate('2024-13-01')).toBe(false);
    });
  });

  describe('isValidAmount', () => {
    it('should return true for valid amounts', () => {
      expect(isValidAmount(100)).toBe(true);
      expect(isValidAmount('50.5')).toBe(true);
    });

    it('should return false for invalid amounts', () => {
      expect(isValidAmount(-10)).toBe(false);
      expect(isValidAmount('abc')).toBe(false);
    });
  });

  describe('sanitizeText', () => {
    it('should remove dangerous characters', () => {
      expect(sanitizeText('<script>alert(1)</script>')).toBe('alert(1)');
    });

    it('should trim whitespace', () => {
      expect(sanitizeText('  hello  ')).toBe('hello');
    });
  });
});
