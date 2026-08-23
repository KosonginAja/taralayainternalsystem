export function formatRupiah(value) {
    if (value === null || value === undefined || value === '')
        return 'Rp 0';
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num))
        return 'Rp 0';
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(num);
}
export function formatDate(value) {
    if (!value)
        return '—';
    const date = new Date(value);
    return new Intl.DateTimeFormat('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    }).format(date);
}
export function cn(...classes) {
    return classes.filter(Boolean).join(' ');
}
//# sourceMappingURL=utils.js.map