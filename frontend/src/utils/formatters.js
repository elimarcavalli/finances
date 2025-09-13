// Utilitários para formatação de dados

/**
 * Formata valores monetários em Real Brasileiro
 * @param {number} value - Valor a ser formatado
 * @param {number} decimals - Número de casas decimais (padrão: 2)
 * @returns {string} Valor formatado
 */
export const formatCurrency = (value, decimals = 2) => {
  if (value === null || value === undefined || isNaN(value)) {
    return '0,00';
  }
  
  const num = parseFloat(value);
  return num.toLocaleString('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
};

/**
 * Formata valores de criptomoedas com precisão variável
 * @param {number} value - Valor a ser formatado
 * @param {number} decimals - Número máximo de casas decimais (padrão: 8)
 * @returns {string} Valor formatado
 */
export const formatCrypto = (value, decimals = 8) => {
  if (value === null || value === undefined || isNaN(value)) {
    return '0';
  }
  
  const num = parseFloat(value);
  
  // Para valores muito pequenos, mostrar mais decimais
  if (num < 0.001) {
    return num.toLocaleString('pt-BR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: decimals
    });
  }
  
  // Para valores normais, usar menos decimais
  return num.toLocaleString('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: Math.min(decimals, 4)
  });
};

/**
 * Formata percentuais
 * @param {number} value - Valor em decimal (ex: 0.1 = 10%)
 * @param {number} decimals - Número de casas decimais (padrão: 2)
 * @returns {string} Percentual formatado
 */
export const formatPercentage = (value, decimals = 2) => {
  if (value === null || value === undefined || isNaN(value)) {
    return '0,00%';
  }
  
  const percent = parseFloat(value) * 100;
  return `${percent.toLocaleString('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  })}%`;
};

/**
 * Formata data no formato brasileiro
 * @param {string|Date} date - Data a ser formatada
 * @returns {string} Data formatada (DD/MM/AAAA)
 */
export const formatDate = (date) => {
  if (!date) return '--';
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  if (isNaN(dateObj.getTime())) {
    return '--';
  }
  
  return dateObj.toLocaleDateString('pt-BR');
};

/**
 * Formata data e hora no formato brasileiro
 * @param {string|Date} date - Data a ser formatada
 * @returns {string} Data e hora formatadas (DD/MM/AAAA HH:MM)
 */
export const formatDateTime = (date) => {
  if (!date) return '--';
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  if (isNaN(dateObj.getTime())) {
    return '--';
  }
  
  return dateObj.toLocaleDateString('pt-BR') + ' ' + 
         dateObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
};

/**
 * Formata tempo relativo (ex: "há 2 horas")
 * @param {string|Date} date - Data a ser comparada
 * @returns {string} Tempo relativo formatado
 */
export const formatRelativeTime = (date) => {
  if (!date) return '--';
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  if (isNaN(dateObj.getTime())) {
    return '--';
  }
  
  const now = new Date();
  const diffMs = now - dateObj;
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffMinutes < 1) {
    return 'agora';
  } else if (diffMinutes < 60) {
    return `há ${diffMinutes} min`;
  } else if (diffHours < 24) {
    return `há ${diffHours}h`;
  } else if (diffDays < 30) {
    return `há ${diffDays} dias`;
  } else {
    return formatDate(dateObj);
  }
};

/**
 * Formata números grandes de forma compacta (ex: 1.5K, 2.3M)
 * @param {number} value - Valor a ser formatado
 * @param {number} decimals - Número de casas decimais (padrão: 1)
 * @returns {string} Número formatado
 */
export const formatCompactNumber = (value, decimals = 1) => {
  if (value === null || value === undefined || isNaN(value)) {
    return '0';
  }
  
  const num = parseFloat(value);
  
  if (Math.abs(num) < 1000) {
    return formatCurrency(num, decimals);
  } else if (Math.abs(num) < 1000000) {
    return `${formatCurrency(num / 1000, decimals)}K`;
  } else if (Math.abs(num) < 1000000000) {
    return `${formatCurrency(num / 1000000, decimals)}M`;
  } else {
    return `${formatCurrency(num / 1000000000, decimals)}B`;
  }
};

/**
 * Remove formatação de valor monetário (transforma string em número)
 * @param {string} formattedValue - Valor formatado
 * @returns {number} Valor numérico
 */
export const parseCurrency = (formattedValue) => {
  if (!formattedValue || typeof formattedValue !== 'string') {
    return 0;
  }
  
  // Remove todos os caracteres que não são dígitos, vírgula ou ponto
  const cleaned = formattedValue.replace(/[^\d,.]/g, '');
  
  // Trata a vírgula como separador decimal (padrão brasileiro)
  const normalized = cleaned.replace(/\./g, '').replace(',', '.');
  
  return parseFloat(normalized) || 0;
};