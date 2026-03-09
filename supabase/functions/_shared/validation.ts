/**
 * Utilitários de validação e sanitização para Supabase Edge Functions
 */

export function sanitizeEmail(email: string): string {
    return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

export function cleanFormat(value: string): string {
    return value.replace(/[^\d]/g, '');
}

export function isValidCPF(cpf: string): boolean {
    cpf = cleanFormat(cpf);
    if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;
    let sum = 0, rest;
    for (let i = 1; i <= 9; i++) sum = sum + parseInt(cpf.substring(i - 1, i)) * (11 - i);
    rest = (sum * 10) % 11;
    if ((rest === 10) || (rest === 11)) rest = 0;
    if (rest !== parseInt(cpf.substring(9, 10))) return false;
    sum = 0;
    for (let i = 1; i <= 10; i++) sum = sum + parseInt(cpf.substring(i - 1, i)) * (12 - i);
    rest = (sum * 10) % 11;
    if ((rest === 10) || (rest === 11)) rest = 0;
    if (rest !== parseInt(cpf.substring(10, 11))) return false;
    return true;
}

export function isValidCNPJ(cnpj: string): boolean {
    cnpj = cleanFormat(cnpj);
    if (cnpj.length !== 14 || /^(\d)\1+$/.test(cnpj)) return false;
    let length = cnpj.length - 2;
    let numbers = cnpj.substring(0, length);
    const digits = cnpj.substring(length);
    let sum = 0;
    let pos = length - 7;
    for (let i = length; i >= 1; i--) {
        sum += parseInt(numbers.charAt(length - i)) * pos--;
        if (pos < 2) pos = 9;
    }
    let result = sum % 11 < 2 ? 0 : 11 - sum % 11;
    if (result !== parseInt(digits.charAt(0))) return false;
    length = length + 1;
    numbers = cnpj.substring(0, length);
    sum = 0;
    pos = length - 7;
    for (let i = length; i >= 1; i--) {
        sum += parseInt(numbers.charAt(length - i)) * pos--;
        if (pos < 2) pos = 9;
    }
    result = sum % 11 < 2 ? 0 : 11 - sum % 11;
    if (result !== parseInt(digits.charAt(1))) return false;
    return true;
}

export function isValidPhone(phone: string): boolean {
    const cleaned = cleanFormat(phone);
    return cleaned.length >= 10 && cleaned.length <= 11;
}

export function isValidCEP(cep: string): boolean {
    const cleaned = cleanFormat(cep);
    return cleaned.length === 8;
}

export function validatePasswordStrength(password: string): { valid: boolean, message?: string } {
    if (password.length < 6) return { valid: false, message: 'A senha deve ter pelo menos 6 caracteres.' };
    return { valid: true };
}
