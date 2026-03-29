export const escape = value => {
	if (typeof value !== 'string' || !/[\s"]/.test(value)) return value;
	return `"${value.replace(/(["\\])/g, '\\$1')}"`
};