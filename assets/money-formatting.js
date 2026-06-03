/**
 * Formats a money value according to the Shopify money format.
 * 
 * @param {number | string} cents - The amount in cents.
 * @param {string} format - The money format (e.g. "${{amount}}").
 * @param {string} [currency] - Optional currency code.
 * @returns {string} The formatted money string.
 */
export function formatMoney(cents, format, currency = '') {
  if (typeof cents === 'string') cents = cents.replace('.', '');
  let value = '';
  const placeholderRegex = /{{\s*(\w+)\s*}}/;
  const formatString = format || '${{amount}}';

  function defaultOption(opt, def) {
    return typeof opt === 'undefined' ? def : opt;
  }

  function formatWithDelimiters(number, precision, thousands, decimal) {
    precision = defaultOption(precision, 2);
    thousands = defaultOption(thousands, ',');
    decimal = defaultOption(decimal, '.');

    if (isNaN(number) || number == null) return 0;

    number = (number / 100.0).toFixed(precision);

    const parts = number.split('.');
    const dollars = parts[0].replace(/(\d)(?=(\d\d\d)+(?!\d))/g, '$1' + thousands);
    const cents = parts[1] ? decimal + parts[1] : '';

    return dollars + cents;
  }

  switch (formatString.match(placeholderRegex)?.[1]) {
    case 'amount':
      value = formatWithDelimiters(cents, 2);
      break;
    case 'amount_no_decimals':
      value = formatWithDelimiters(cents, 0);
      break;
    case 'amount_with_comma_separator':
      value = formatWithDelimiters(cents, 2, '.', ',');
      break;
    case 'amount_no_decimals_with_comma_separator':
      value = formatWithDelimiters(cents, 0, '.', ',');
      break;
    case 'amount_no_decimals_with_space_separator':
      value = formatWithDelimiters(cents, 0, ' ');
      break;
    case 'amount_with_space_separator':
      value = formatWithDelimiters(cents, 2, ' ', ',');
      break;
    case 'amount_with_period_and_space_separator':
      value = formatWithDelimiters(cents, 2, ' ', '.');
      break;
    case 'amount_with_apostrophe_separator':
      value = formatWithDelimiters(cents, 2, "'", '.');
      break;
  }

  return formatString.replace(placeholderRegex, value);
}

/**
 * Converts a formatted money string back to minor units (cents).
 * 
 * @param {string} value - The formatted money string.
 * @param {string} [currency] - Optional currency code.
 * @returns {number | null} The value in cents, or null if invalid.
 */
export function convertMoneyToMinorUnits(value, currency = '') {
  if (!value) return null;

  // Remove currency symbols and non-numeric characters except for decimal/thousands separators
  const cleanValue = value.replace(/[^\d.,]/g, '');

  // Detect if comma is used as decimal separator (European style)
  // If there's a comma and it's followed by 1-2 digits at the end, it's likely a decimal
  const isCommaDecimal = /,(\d{1,2})$/.test(cleanValue);

  let normalizedValue = cleanValue;
  if (isCommaDecimal) {
    // Replace thousands dots, then replace decimal comma with dot
    normalizedValue = normalizedValue.replace(/\./g, '').replace(',', '.');
  } else {
    // Replace thousands commas, then it's already using dot for decimal
    normalizedValue = normalizedValue.replace(/,/g, '');
  }

  const numericValue = parseFloat(normalizedValue);
  if (isNaN(numericValue)) return null;

  // Zero-decimal currencies (Shopify handles this, but we can be safe)
  const zeroDecimalCurrencies = ['BIF', 'CLP', 'DJF', 'GNF', 'JPY', 'KMF', 'KRW', 'MGA', 'PYG', 'RWF', 'UGX', 'VND', 'VUV', 'XAF', 'XOF', 'XPF'];
  if (zeroDecimalCurrencies.includes(currency.toUpperCase())) {
    return Math.round(numericValue);
  }

  return Math.round(numericValue * 100);
}
