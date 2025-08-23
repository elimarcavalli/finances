// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";
import "@chainlink/contracts/src/v0.8/automation/AutomationCompatible.sol";

// Uniswap V3 Router interface
interface ISwapRouter {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }

    function exactInputSingle(ExactInputSingleParams calldata params)
        external
        payable
        returns (uint256 amountOut);
}

/**
 * @title StrategyVault
 * @dev Smart contract que implementa uma estratégia de trading automatizada
 * usando oráculos Chainlink e Uniswap V3 para execução de swaps
 */
contract StrategyVault is Ownable, Pausable, ReentrancyGuard, AutomationCompatibleInterface {
    using SafeERC20 for IERC20;

    // State variables
    ISwapRouter public immutable uniswapRouter;
    AggregatorV3Interface public priceFeed;
    
    address public tokenToSpend;      // Token a ser gasto (ex: USDC)
    address public tokenToBuy;        // Token a ser comprado (ex: WMATIC)
    uint24 public poolFee;            // Taxa da pool Uniswap (ex: 3000 = 0.3%)
    
    int256 public targetPrice;        // Preço alvo (8 decimais - padrão Chainlink)
    uint256 public amountToSpend;     // Quantidade a ser gasta no swap
    
    bool public strategyActive;       // Se a estratégia está ativa
    uint256 public lastExecutionTime; // Timestamp da última execução

    // Events
    event Deposit(address indexed token, uint256 amount, address indexed depositor);
    event Withdrawal(address indexed token, uint256 amount, address indexed owner);
    event StrategyParamsSet(
        address tokenToSpend,
        address tokenToBuy,
        int256 targetPrice,
        uint256 amountToSpend,
        uint24 poolFee
    );
    event StrategyExecuted(
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        int256 currentPrice
    );
    event StrategyActivated(bool active);

    constructor(
        address _uniswapRouter,
        address _priceFeed,
        address _initialOwner
    ) Ownable(_initialOwner) {
        require(_uniswapRouter != address(0), "Invalid Uniswap router");
        require(_priceFeed != address(0), "Invalid price feed");
        
        uniswapRouter = ISwapRouter(_uniswapRouter);
        priceFeed = AggregatorV3Interface(_priceFeed);
        
        poolFee = 3000; // 0.3% default
        strategyActive = false;
    }

    /**
     * @dev Permite depósito de tokens ERC20 no contrato
     * @param _tokenAddress Endereço do token a ser depositado
     * @param _amount Quantidade a ser depositada
     */
    function deposit(address _tokenAddress, uint256 _amount) 
        external 
        nonReentrant 
        whenNotPaused 
    {
        require(_tokenAddress != address(0), "Invalid token address");
        require(_amount > 0, "Amount must be greater than 0");
        
        IERC20 token = IERC20(_tokenAddress);
        uint256 balanceBefore = token.balanceOf(address(this));
        
        token.safeTransferFrom(msg.sender, address(this), _amount);
        
        uint256 balanceAfter = token.balanceOf(address(this));
        uint256 actualAmount = balanceAfter - balanceBefore;
        
        emit Deposit(_tokenAddress, actualAmount, msg.sender);
    }

    /**
     * @dev Permite ao owner retirar tokens do contrato
     * @param _tokenAddress Endereço do token a ser retirado
     * @param _amount Quantidade a ser retirada
     */
    function withdraw(address _tokenAddress, uint256 _amount) 
        external 
        onlyOwner 
        nonReentrant 
    {
        require(_tokenAddress != address(0), "Invalid token address");
        require(_amount > 0, "Amount must be greater than 0");
        
        IERC20 token = IERC20(_tokenAddress);
        uint256 contractBalance = token.balanceOf(address(this));
        require(contractBalance >= _amount, "Insufficient contract balance");
        
        token.safeTransfer(owner(), _amount);
        
        emit Withdrawal(_tokenAddress, _amount, owner());
    }

    /**
     * @dev Configura os parâmetros da estratégia
     * @param _tokenToSpend Token a ser gasto
     * @param _tokenToBuy Token a ser comprado
     * @param _targetPrice Preço alvo (8 decimais)
     * @param _amountToSpend Quantidade a ser gasta
     * @param _poolFee Taxa da pool Uniswap
     */
    function setStrategyParams(
        address _tokenToSpend,
        address _tokenToBuy,
        int256 _targetPrice,
        uint256 _amountToSpend,
        uint24 _poolFee
    ) external onlyOwner {
        require(_tokenToSpend != address(0), "Invalid tokenToSpend");
        require(_tokenToBuy != address(0), "Invalid tokenToBuy");
        require(_targetPrice > 0, "Target price must be positive");
        require(_amountToSpend > 0, "Amount must be greater than 0");
        require(_poolFee == 500 || _poolFee == 3000 || _poolFee == 10000, "Invalid pool fee");
        
        tokenToSpend = _tokenToSpend;
        tokenToBuy = _tokenToBuy;
        targetPrice = _targetPrice;
        amountToSpend = _amountToSpend;
        poolFee = _poolFee;
        
        emit StrategyParamsSet(_tokenToSpend, _tokenToBuy, _targetPrice, _amountToSpend, _poolFee);
    }

    /**
     * @dev Ativa ou desativa a estratégia
     * @param _active Estado da estratégia
     */
    function setStrategyActive(bool _active) external onlyOwner {
        strategyActive = _active;
        emit StrategyActivated(_active);
    }

    /**
     * @dev Obtém o preço atual do oráculo Chainlink
     * @return Preço atual com 8 decimais
     */
    /**
     * @dev Obtém o preço mais recente do oráculo Chainlink com validações de segurança
     * @return price O preço atual em formato int256 (8 decimais)
     */
    function getLatestPrice() public view returns (int256) {
        (
            uint80 roundId,
            int256 price,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        ) = priceFeed.latestRoundData();
        
        // Validações de segurança para dados do oráculo
        require(price > 0, "Invalid price from oracle");
        require(roundId > 0, "Invalid round ID");
        require(updatedAt > 0, "Price not updated");
        require(answeredInRound >= roundId, "Stale price data");
        
        // Verificar se o preço não é muito antigo (máximo 1 hora)
        require(block.timestamp - updatedAt <= 3600, "Price data too old");
        
        return price;
    }

    /**
     * @dev Função principal que verifica e executa a estratégia
     * Esta função é chamada pelo Keeper
     */
    function performStrategyCheck() external nonReentrant whenNotPaused {
        require(strategyActive, "Strategy is not active");
        require(tokenToSpend != address(0), "Strategy not configured");
        require(tokenToBuy != address(0), "Strategy not configured");
        
        int256 currentPrice = getLatestPrice();
        
        // Verifica se o preço atual é menor ou igual ao target price
        if (currentPrice <= targetPrice) {
            _executeSwap(currentPrice);
        }
    }

    /**
     * @dev Executa o swap via Uniswap V3
     * @param currentPrice Preço atual para logging
     */
    function _executeSwap(int256 currentPrice) internal {
        IERC20 tokenIn = IERC20(tokenToSpend);
        uint256 contractBalance = tokenIn.balanceOf(address(this));
        
        require(contractBalance >= amountToSpend, "Insufficient balance for swap");
        
        // Aprova o router para gastar o token
        require(tokenIn.approve(address(uniswapRouter), amountToSpend), "Approval failed");
        
        // Configura os parâmetros do swap
        ISwapRouter.ExactInputSingleParams memory params = ISwapRouter.ExactInputSingleParams({
            tokenIn: tokenToSpend,
            tokenOut: tokenToBuy,
            fee: poolFee,
            recipient: address(this),
            deadline: block.timestamp + 300, // 5 minutos
            amountIn: amountToSpend,
            amountOutMinimum: 0, // Em produção, calcular um mínimo baseado no slippage
            sqrtPriceLimitX96: 0
        });
        
        // Executa o swap
        uint256 amountOut = uniswapRouter.exactInputSingle(params);
        
        lastExecutionTime = block.timestamp;
        
        emit StrategyExecuted(
            tokenToSpend,
            tokenToBuy,
            amountToSpend,
            amountOut,
            currentPrice
        );
        
        // Desativa a estratégia após execução (estratégia de execução única)
        strategyActive = false;
        emit StrategyActivated(false);
    }

    /**
     * @dev Função de emergência para pausar o contrato
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @dev Função para despausar o contrato
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @dev Obtém informações gerais do vault
     */
    function getVaultInfo() external view returns (
        address _tokenToSpend,
        address _tokenToBuy,
        int256 _targetPrice,
        uint256 _amountToSpend,
        bool _strategyActive,
        uint256 _lastExecutionTime,
        int256 _currentPrice
    ) {
        return (
            tokenToSpend,
            tokenToBuy,
            targetPrice,
            amountToSpend,
            strategyActive,
            lastExecutionTime,
            getLatestPrice()
        );
    }

    /**
     * @dev Obtém o saldo de um token específico no contrato
     * @param _token Endereço do token
     */
    function getTokenBalance(address _token) external view returns (uint256) {
        return IERC20(_token).balanceOf(address(this));
    }

    // ===== CHAINLINK AUTOMATION FUNCTIONS =====

    /**
     * @dev Função chamada off-chain pelos nós Chainlink para verificar se há trabalho a ser feito
     * @param checkData Dados para verificação (não usado neste caso)
     * @return upkeepNeeded Se a manutenção é necessária
     * @return performData Dados a serem passados para performUpkeep
     */
    function checkUpkeep(bytes calldata checkData) 
        external 
        view 
        override 
        returns (bool upkeepNeeded, bytes memory performData) 
    {
        // Verificar se a estratégia está ativa e configurada
        bool isActive = strategyActive && !paused();
        bool isConfigured = tokenToSpend != address(0) && tokenToBuy != address(0);
        bool hasBalance = IERC20(tokenToSpend).balanceOf(address(this)) >= amountToSpend;
        
        if (!isActive || !isConfigured || !hasBalance) {
            return (false, "");
        }

        try this.getLatestPrice() returns (int256 currentPrice) {
            // Verifica se o preço atual atende à condição da estratégia
            upkeepNeeded = currentPrice <= targetPrice;
            performData = abi.encode(currentPrice);
        } catch {
            // Se falhar ao obter o preço, não executa
            upkeepNeeded = false;
            performData = "";
        }
    }

    /**
     * @dev Função chamada on-chain por um nó Chainlink para executar a estratégia
     * @param performData Dados retornados pela função checkUpkeep
     */
    function performUpkeep(bytes calldata performData) external override {
        // Decodifica o preço atual dos dados
        int256 currentPrice = abi.decode(performData, (int256));
        
        // Verifica novamente as condições (por segurança)
        require(strategyActive, "Strategy is not active");
        require(!paused(), "Contract is paused");
        require(tokenToSpend != address(0), "Strategy not configured");
        require(tokenToBuy != address(0), "Strategy not configured");
        
        // Obtém o preço atual para verificação dupla
        int256 latestPrice = getLatestPrice();
        require(latestPrice <= targetPrice, "Price condition not met");
        
        // Verifica se há saldo suficiente
        IERC20 tokenIn = IERC20(tokenToSpend);
        uint256 contractBalance = tokenIn.balanceOf(address(this));
        require(contractBalance >= amountToSpend, "Insufficient balance for swap");
        
        // Executa o swap
        _executeSwap(latestPrice);
        
        // Atualiza o timestamp da última execução
        lastExecutionTime = block.timestamp;
        
        // Emite evento
        emit StrategyExecuted(
            tokenToSpend,
            tokenToBuy, 
            amountToSpend,
            0, // amountOut será calculado após o swap
            latestPrice
        );
    }
}