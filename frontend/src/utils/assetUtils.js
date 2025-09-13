// Utilitários para trabalhar com ativos

/**
 * Mapeamento de cores para classes de ativos
 */
const ASSET_CLASS_COLORS = {
  'CRIPTO': 'yellow',
  'ACAO_BR': 'blue',
  'ACAO_US': 'violet',
  'PREVIDENCIA': 'grape',
  'FUNDO': 'indigo',
  'FII': 'green',
  'COE': 'teal',
  'RENDA_FIXA': 'cyan',
  'TESOURO': 'lime',
  'COMMODITIES': 'orange',
  'OUTROS': 'gray',
  'PATRIMONIO_FISICO': 'brown'
};

/**
 * Retorna a cor apropriada para uma classe de ativo
 * @param {string} assetClass - Classe do ativo
 * @returns {string} Nome da cor do Mantine
 */
export const getAssetClassColor = (assetClass) => {
  return ASSET_CLASS_COLORS[assetClass] || 'gray';
};

/**
 * Mapeamento de nomes legíveis para classes de ativos
 */
const ASSET_CLASS_NAMES = {
  'CRIPTO': 'Criptomoedas',
  'ACAO_BR': 'Ações Brasil',
  'ACAO_US': 'Ações EUA',
  'PREVIDENCIA': 'Previdência',
  'FUNDO': 'Fundos',
  'FII': 'Fundos Imobiliários',
  'COE': 'COE',
  'RENDA_FIXA': 'Renda Fixa',
  'TESOURO': 'Tesouro Direto',
  'COMMODITIES': 'Commodities',
  'OUTROS': 'Outros',
  'PATRIMONIO_FISICO': 'Patrimônio Físico'
};

/**
 * Retorna o nome legível de uma classe de ativo
 * @param {string} assetClass - Classe do ativo
 * @returns {string} Nome legível
 */
export const getAssetClassName = (assetClass) => {
  return ASSET_CLASS_NAMES[assetClass] || assetClass;
};

/**
 * Verifica se um ativo é uma criptomoeda
 * @param {string} assetClass - Classe do ativo
 * @returns {boolean} True se for cripto
 */
export const isCryptoAsset = (assetClass) => {
  return assetClass === 'CRIPTO';
};

/**
 * Verifica se um ativo é uma ação
 * @param {string} assetClass - Classe do ativo
 * @returns {boolean} True se for ação
 */
export const isStockAsset = (assetClass) => {
  return ['ACAO_BR', 'ACAO_US'].includes(assetClass);
};

/**
 * Verifica se um ativo é de renda fixa
 * @param {string} assetClass - Classe do ativo
 * @returns {boolean} True se for renda fixa
 */
export const isFixedIncomeAsset = (assetClass) => {
  return ['RENDA_FIXA', 'TESOURO', 'COE'].includes(assetClass);
};

/**
 * Verifica se um ativo é um fundo
 * @param {string} assetClass - Classe do ativo
 * @returns {boolean} True se for fundo
 */
export const isFundAsset = (assetClass) => {
  return ['FUNDO', 'FII', 'PREVIDENCIA'].includes(assetClass);
};

/**
 * Retorna a precisão decimal apropriada para um tipo de ativo
 * @param {string} assetClass - Classe do ativo
 * @returns {number} Número de casas decimais
 */
export const getAssetPrecision = (assetClass) => {
  switch (assetClass) {
    case 'CRIPTO':
      return 8; // Criptomoedas podem ter muitas casas decimais
    case 'ACAO_BR':
    case 'ACAO_US':
      return 2; // Ações geralmente 2 casas decimais
    case 'FII':
      return 2; // FIIs também 2 casas decimais
    case 'RENDA_FIXA':
    case 'TESOURO':
    case 'COE':
      return 2; // Renda fixa 2 casas decimais
    default:
      return 2; // Padrão 2 casas decimais
  }
};

/**
 * Filtra ativos por classe
 * @param {Array} assets - Array de ativos
 * @param {string|Array} assetClasses - Classe(s) de ativo para filtrar
 * @returns {Array} Array de ativos filtrados
 */
export const filterAssetsByClass = (assets, assetClasses) => {
  if (!Array.isArray(assets)) return [];
  
  const classes = Array.isArray(assetClasses) ? assetClasses : [assetClasses];
  
  return assets.filter(asset => classes.includes(asset.asset_class));
};

/**
 * Agrupa ativos por classe
 * @param {Array} assets - Array de ativos
 * @returns {Object} Objeto com ativos agrupados por classe
 */
export const groupAssetsByClass = (assets) => {
  if (!Array.isArray(assets)) return {};
  
  return assets.reduce((acc, asset) => {
    const className = asset.asset_class;
    if (!acc[className]) {
      acc[className] = [];
    }
    acc[className].push(asset);
    return acc;
  }, {});
};

/**
 * Ordena ativos por critério
 * @param {Array} assets - Array de ativos
 * @param {string} sortBy - Critério de ordenação ('symbol', 'name', 'class', 'price')
 * @param {string} order - Ordem ('asc' ou 'desc')
 * @returns {Array} Array de ativos ordenados
 */
export const sortAssets = (assets, sortBy = 'symbol', order = 'asc') => {
  if (!Array.isArray(assets)) return [];
  
  const sorted = [...assets].sort((a, b) => {
    let valueA, valueB;
    
    switch (sortBy) {
      case 'symbol':
        valueA = a.symbol || '';
        valueB = b.symbol || '';
        break;
      case 'name':
        valueA = a.name || '';
        valueB = b.name || '';
        break;
      case 'class':
        valueA = getAssetClassName(a.asset_class) || '';
        valueB = getAssetClassName(b.asset_class) || '';
        break;
      case 'price':
        valueA = parseFloat(a.last_price_brl) || 0;
        valueB = parseFloat(b.last_price_brl) || 0;
        break;
      default:
        valueA = a.symbol || '';
        valueB = b.symbol || '';
    }
    
    if (typeof valueA === 'string') {
      valueA = valueA.toLowerCase();
      valueB = valueB.toLowerCase();
    }
    
    if (order === 'desc') {
      return valueA < valueB ? 1 : -1;
    } else {
      return valueA > valueB ? 1 : -1;
    }
  });
  
  return sorted;
};

/**
 * Busca ativos por texto
 * @param {Array} assets - Array de ativos
 * @param {string} searchText - Texto de busca
 * @returns {Array} Array de ativos filtrados
 */
export const searchAssets = (assets, searchText) => {
  if (!Array.isArray(assets) || !searchText) return assets;
  
  const search = searchText.toLowerCase();
  
  return assets.filter(asset => 
    (asset.symbol && asset.symbol.toLowerCase().includes(search)) ||
    (asset.name && asset.name.toLowerCase().includes(search)) ||
    (asset.asset_class && getAssetClassName(asset.asset_class).toLowerCase().includes(search))
  );
};