// Lista curada de tokens verificados da Polygon Mainnet
export const POLYGON_TOKENS = [
  // Tokens Principais - Stablecoins e Principais
  {
    name: 'USD Coin',
    symbol: 'USDC',
    address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
    logoURI: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86a33E6441C15b1c9d93aF0e0f45cB53AF3C3/logo.png',
    category: 'principal'
  },
  {
    name: 'Tether USD',
    symbol: 'USDT',
    address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
    logoURI: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xdAC17F958D2ee523a2206206994597C13D831ec7/logo.png',
    category: 'principal'
  },
  {
    name: 'Wrapped Matic',
    symbol: 'WMATIC',
    address: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
    logoURI: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/polygon/assets/0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270/logo.png',
    category: 'principal'
  },
  {
    name: 'Wrapped Ether',
    symbol: 'WETH',
    address: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
    logoURI: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2/logo.png',
    category: 'principal'
  },
  {
    name: 'Wrapped Bitcoin',
    symbol: 'WBTC',
    address: '0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6',
    logoURI: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599/logo.png',
    category: 'principal'
  },
  {
    name: 'Dai Stablecoin',
    symbol: 'DAI',
    address: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063',
    logoURI: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x6B175474E89094C44Da98b954EedeAC495271d0F/logo.png',
    category: 'principal'
  },

  // DeFi Tokens
  {
    name: 'Uniswap',
    symbol: 'UNI',
    address: '0xb33EaAd8d922B1083446DC23f610c2567fB5180f',
    logoURI: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984/logo.png',
    category: 'defi'
  },
  {
    name: 'Aave',
    symbol: 'AAVE',
    address: '0xD6DF932A45C0f255f85145f286eA0b292B21C90B',
    logoURI: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9/logo.png',
    category: 'defi'
  },
  {
    name: 'Chainlink',
    symbol: 'LINK',
    address: '0x53E0bca35eC356BD5ddDFebbD1Fc0fD03FaBad39',
    logoURI: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x514910771AF9Ca656af840dff83E8264EcF986CA/logo.png',
    category: 'defi'
  },
  {
    name: 'Curve DAO Token',
    symbol: 'CRV',
    address: '0x172370d5Cd63279eFa6d502DAB29171933a610AF',
    logoURI: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xD533a949740bb3306d119CC777fa900bA034cd52/logo.png',
    category: 'defi'
  },
  {
    name: 'SushiSwap',
    symbol: 'SUSHI',
    address: '0x0b3F868E0BE5597D5DB7fEB59E1CADBb0fdDa50a',
    logoURI: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x6B3595068778DD592e39A122f4f5a5cF09C90fE2/logo.png',
    category: 'defi'
  },

  // Layer 1 Tokens
  {
    name: 'Avalanche',
    symbol: 'AVAX',
    address: '0x2C89bbc92BD86F8075d1DEcc58C7F4E0107f286b',
    logoURI: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/avalanchec/info/logo.png',
    category: 'layer1'
  },
  {
    name: 'BNB',
    symbol: 'BNB',
    address: '0x3BA4c387f786bFEE076A58914F5Bd38d668B42c3',
    logoURI: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/smartchain/info/logo.png',
    category: 'layer1'
  },

  // Gaming & NFT Tokens
  {
    name: 'ApeCoin',
    symbol: 'APE',
    address: '0xB7b31a6BC18e48888545CE79e83E06003bE70930',
    logoURI: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x4d224452801ACEd8B2F0aebE155379bb5D594381/logo.png',
    category: 'gaming'
  },
  {
    name: 'The Sandbox',
    symbol: 'SAND',
    address: '0xBbba073C31bF03b8ACf7c28EF0738DeCF3695683',
    logoURI: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x3845badAde8e6dFF049820680d1F14bD3903a5d0/logo.png',
    category: 'gaming'
  },
  {
    name: 'Decentraland',
    symbol: 'MANA',
    address: '0xA1c57f48F0Deb89f569dFbE6E2B7f46D33606fD4',
    logoURI: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x0F5D2fB29fb7d3CFeE444a200298f468908cC942/logo.png',
    category: 'gaming'
  },

  // AI Tokens
  {
    name: 'Fetch.ai',
    symbol: 'FET',
    address: '0x7583FEDDbceFA813dc18259940F76a02710A8905',
    logoURI: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xaea46A60368A7bD060eec7DF8CBa43b7EF41Ad85/logo.png',
    category: 'ia'
  },
  {
    name: 'SingularityNET',
    symbol: 'AGIX',
    address: '0x190Eb8a183D22a4bdf278c6791b152395d72bf4c',
    logoURI: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x5B7533812759B45C2B44C19e320ba2cD2681b542/logo.png',
    category: 'ia'
  },

  // Meme Tokens
  {
    name: 'Shiba Inu',
    symbol: 'SHIB',
    address: '0x6f8a06447Ff6FcF75d803135a7de15CE88C1d4ec',
    logoURI: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE/logo.png',
    category: 'meme'
  },
  {
    name: 'Dogecoin',
    symbol: 'DOGE',
    address: '0x7C4e6B8158b76b0A587df84eFd7Ea37a9506bdA1',
    logoURI: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/dogecoin/info/logo.png',
    category: 'meme'
  },

  // Polygon Ecosystem
  {
    name: 'QuickSwap',
    symbol: 'QUICK',
    address: '0x831753DD7087CaC61aB5644b308642cc1c33Dc13',
    logoURI: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/polygon/assets/0x831753DD7087CaC61aB5644b308642cc1c33Dc13/logo.png',
    category: 'polygon'
  },
  {
    name: 'Gains Network',
    symbol: 'GNS',
    address: '0xE5417Af564e4bFDA1c483642db72007871397896',
    logoURI: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/polygon/assets/0xE5417Af564e4bFDA1c483642db72007871397896/logo.png',
    category: 'polygon'
  }
];

// Função helper para buscar token por endereço
export const findTokenByAddress = (address) => {
  return POLYGON_TOKENS.find(token => 
    token.address.toLowerCase() === address.toLowerCase()
  );
};

// Função helper para filtrar tokens por categoria
export const getTokensByCategory = (category) => {
  return POLYGON_TOKENS.filter(token => token.category === category);
};

// Categorias disponíveis
export const TOKEN_CATEGORIES = [
  { value: 'principal', label: 'Principais' },
  { value: 'defi', label: 'DeFi' },
  { value: 'layer1', label: 'Layer 1' },
  { value: 'gaming', label: 'Gaming & NFT' },
  { value: 'ia', label: 'Inteligência Artificial' },
  { value: 'meme', label: 'Meme Tokens' },
  { value: 'polygon', label: 'Polygon Ecosystem' }
];