import { ethers } from "hardhat";

async function main() {
  console.log("Deploying StrategyVault contract...");

  // Endereços para a rede Polygon Mainnet (PRODUÇÃO)
  const UNISWAP_V3_ROUTER = "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45"; // SwapRouter02 Mainnet
  const MATIC_USD_PRICE_FEED = "0xAB594600376Ec9fD91F8e885dADF0CE036862dE0"; // MATIC/USD Polygon Mainnet

  // Obtém a carteira que fará o deploy a partir da PRIVATE_KEY no .env
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance));

  // Deploy do contrato
  const StrategyVault = await ethers.getContractFactory("StrategyVault");
  const strategyVault = await StrategyVault.deploy(
    UNISWAP_V3_ROUTER,
    MATIC_USD_PRICE_FEED,
    deployer.address // initial owner
  );

  // Espera o contrato ser minerado e implantado
  await strategyVault.waitForDeployment();

  const contractAddress = await strategyVault.getAddress();
  console.log(`StrategyVault deployed to: ${contractAddress}`);
}

// Padrão recomendado para executar scripts assíncronos
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});