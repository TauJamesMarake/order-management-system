export function validateEmail(value: string): string | null {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
        ? null
        : 'Must be a valid email address.'
}

export function validateOrderPrefix(value: string): string | null {
    if (!/^[A-Z]{2,10}$/.test(value)) {
        return 'Must be 2–10 uppercase letters (A–Z) with no spaces or numbers.'
    }
    return null
}

export function validatePassword(value: string): string | null {
    if (value.length < 12) {
        return 'Must be at least 12 characters.'
    }
    return null
}

export function validateMinLength(
    field: string,
    value: string,
    min: number,
    max: number,
): string | null {
    if (value.length < min) return `${field} must be at least ${min} characters.`
    if (value.length > max) return `${field} must not exceed ${max} characters.`
    return null
}