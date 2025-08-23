import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "dotenv/config";

// Busca as variáveis de ambiente de forma segura
const POLYGON_RPC_URL = process.env.POLYGON_RPC_URL || "https://polygon-rpc.com/";
const PRIVATE_KEY = process.env.PRIVATE_KEY || "";
const POLYGONSCAN_API_KEY = process.env.POLYGONSCAN_API_KEY || "";

const config: HardhatUserConfig = {
  solidity: "0.8.20", // Use uma versão específica e moderna
  networks: {
    hardhat: {}, // Rede de teste local padrão
    polygon_mainnet: {
      url: POLYGON_RPC_URL,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
      chainId: 137
    },
  },
  etherscan: {
    apiKey: {
      polygonAmoy: POLYGONSCAN_API_KEY,
    }
  },
  gasReporter: {
    enabled: true,
    currency: "USD",
  },
};

export default config;