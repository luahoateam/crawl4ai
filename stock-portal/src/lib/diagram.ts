export function formatRatio(ratio: string | number | null | undefined): string {
  if (ratio === null || ratio === undefined || ratio === '') {
    return '';
  }

  if (typeof ratio === 'string') {
    if (ratio.endsWith('%')) {
      return ratio;
    }
    const parsed = parseFloat(ratio);
    if (isNaN(parsed)) {
      return '';
    }
    ratio = parsed;
  }

  if (typeof ratio === 'number') {
    if (ratio < 1 && ratio > 0) {
      return `${Math.round(ratio * 1000) / 10}%`;
    }
    return `${ratio}%`;
  }

  return '';
}

export function calculateColorIntensity(ratio: string | number | null | undefined): string {
  const formatted = formatRatio(ratio);
  if (formatted === '') {
    return 'rgba(59, 130, 246, 0.3)';
  }
  const numValue = parseFloat(formatted.replace('%', ''));
  
  if (numValue >= 70) {
    return 'rgba(59, 130, 246, 0.9)';
  }
  if (numValue >= 35) {
    return 'rgba(59, 130, 246, 0.65)';
  }
  return 'rgba(59, 130, 246, 0.3)';
}
