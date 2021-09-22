// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

import '../tools/tokens/IERC20Detailed.sol';
import '../access/interfaces/IMarketAccessController.sol';
import '../access/AccessFlags.sol';
import '../interfaces/ILendingPool.sol';
import '../interfaces/ILendingPoolConfigurator.sol';
import '../interfaces/IStableDebtToken.sol';
import '../interfaces/IVariableDebtToken.sol';
import '../protocol/libraries/configuration/ReserveConfiguration.sol';
import '../protocol/libraries/configuration/UserConfiguration.sol';
import '../protocol/libraries/types/DataTypes.sol';
import '../interfaces/IReserveRateStrategy.sol';
import '../interfaces/IPoolAddressProvider.sol';
import './interfaces/IUiPoolDataProvider.sol';
import '../interfaces/IPriceOracleGetter.sol';
import '../interfaces/IDepositToken.sol';
import '../interfaces/IDerivedToken.sol';
import '../interfaces/IRewardedToken.sol';
import '../interfaces/IUnderlyingBalance.sol';
import '../reward/interfaces/IManagedRewardPool.sol';
import '../reward/interfaces/IRewardExplainer.sol';
import '../protocol/stake/interfaces/IStakeConfigurator.sol';
import '../protocol/stake/interfaces/IStakeToken.sol';

contract ProtocolDataProvider is IUiPoolDataProvider {
  using ReserveConfiguration for DataTypes.ReserveConfigurationMap;
  using UserConfiguration for DataTypes.UserConfigurationMap;

  address public constant ETH = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;
  address public constant USD = 0x10F7Fc1F91Ba351f9C629c5947AD69bD03C05b96;

  // solhint-disable-next-line var-name-mixedcase
  IMarketAccessController public immutable ADDRESS_PROVIDER;

  constructor(IMarketAccessController addressesProvider) {
    ADDRESS_PROVIDER = addressesProvider;
  }

  function getAllTokenDescriptions(bool includeAssets)
    external
    view
    override
    returns (TokenDescription[] memory tokens, uint256 tokenCount)
  {
    ILendingPool pool = ILendingPool(ADDRESS_PROVIDER.getLendingPool());
    address[] memory reserveList = pool.getReservesList();

    address[] memory stakeList;
    IStakeConfigurator stakeCfg = IStakeConfigurator(_getAddress(AccessFlags.STAKE_CONFIGURATOR));
    if (address(stakeCfg) != address(0)) {
      stakeList = stakeCfg.list();
    }

    tokenCount = 2 + stakeList.length + reserveList.length * 3;
    if (includeAssets) {
      tokenCount += reserveList.length;
    }

    tokens = new TokenDescription[](tokenCount);

    tokenCount = 0;
    address token = _getAddress(AccessFlags.REWARD_TOKEN);
    if (token != address(0)) {
      tokens[tokenCount] = TokenDescription(
        token,
        token,
        address(0),
        IERC20Detailed(token).symbol(),
        address(0),
        IERC20Detailed(token).decimals(),
        TokenType.Reward,
        true,
        false
      );
      tokenCount++;
    }

    token = _getAddress(AccessFlags.REWARD_STAKE_TOKEN);
    if (token != address(0)) {
      tokens[tokenCount] = TokenDescription(
        token,
        address(0),
        token,
        IERC20Detailed(token).symbol(),
        tokens[0].token,
        IERC20Detailed(token).decimals(),
        TokenType.RewardStake,
        true,
        false
      );
      tokenCount++;
    }

    for (uint256 i = 0; i < reserveList.length; i++) {
      token = reserveList[i];
      DataTypes.ReserveData memory reserveData = pool.getReserveData(token);
      (bool isActive, bool isFrozen, bool canBorrow, bool canBorrowStable) = reserveData.configuration.getFlagsMemory();

      canBorrow = isActive && canBorrow;
      canBorrowStable = canBorrowStable && canBorrow;

      uint8 decimals = reserveData.configuration.getDecimalsMemory();

      if (includeAssets) {
        address underlying;
        if (reserveData.configuration.isExternalStrategyMemory()) {
          underlying = IUnderlyingStrategy(reserveData.strategy).getUnderlying(token);
        }

        tokens[tokenCount] = TokenDescription(
          token,
          token,
          address(0),
          IERC20Detailed(token).symbol(),
          underlying,
          decimals,
          TokenType.PoolAsset,
          true,
          false
        );
        tokenCount++;
      }

      address subToken = reserveData.depositTokenAddress;
      tokens[tokenCount] = TokenDescription(
        subToken,
        token,
        IRewardedToken(subToken).getIncentivesController(),
        IERC20Detailed(subToken).symbol(),
        token,
        decimals,
        TokenType.Deposit,
        isActive,
        isFrozen
      );
      tokenCount++;

      if (reserveData.variableDebtTokenAddress != address(0)) {
        subToken = reserveData.variableDebtTokenAddress;
        tokens[tokenCount] = TokenDescription(
          subToken,
          token,
          IRewardedToken(subToken).getIncentivesController(),
          IERC20Detailed(subToken).symbol(),
          token,
          decimals,
          TokenType.VariableDebt,
          canBorrow,
          isFrozen
        );
        tokenCount++;
      }

      if (reserveData.stableDebtTokenAddress != address(0)) {
        subToken = reserveData.stableDebtTokenAddress;
        tokens[tokenCount] = TokenDescription(
          subToken,
          token,
          IRewardedToken(subToken).getIncentivesController(),
          IERC20Detailed(subToken).symbol(),
          token,
          decimals,
          TokenType.StableDebt,
          canBorrowStable,
          isFrozen
        );
        tokenCount++;
      }
    }

    for (uint256 i = 0; i < stakeList.length; i++) {
      token = stakeList[i];
      address underlying = IDerivedToken(token).UNDERLYING_ASSET_ADDRESS();
      tokens[tokenCount] = TokenDescription(
        token,
        underlying,
        IRewardedToken(token).getIncentivesController(),
        IERC20Detailed(token).symbol(),
        underlying,
        IERC20Detailed(token).decimals(),
        TokenType.Stake,
        true,
        false
      );
      tokenCount++;
    }

    return (tokens, tokenCount);
  }

  function getAllTokens(bool includeAssets)
    public
    view
    override
    returns (
      address[] memory tokens,
      uint256 tokenCount,
      TokenType[] memory tokenTypes
    )
  {
    ILendingPool pool = ILendingPool(ADDRESS_PROVIDER.getLendingPool());
    address[] memory reserveList = pool.getReservesList();

    address[] memory stakeList;
    IStakeConfigurator stakeCfg = IStakeConfigurator(_getAddress(AccessFlags.STAKE_CONFIGURATOR));
    if (address(stakeCfg) != address(0)) {
      stakeList = stakeCfg.list();
    }

    tokenCount = 2 + stakeList.length + reserveList.length * 3;
    if (includeAssets) {
      tokenCount += reserveList.length;
    }
    tokens = new address[](tokenCount);
    tokenTypes = new TokenType[](tokenCount);

    tokenCount = 0;

    tokens[tokenCount] = _getAddress(AccessFlags.REWARD_TOKEN);
    tokenTypes[tokenCount] = TokenType.Reward;
    if (tokens[tokenCount] != address(0)) {
      tokenCount++;
    }

    tokens[tokenCount] = _getAddress(AccessFlags.REWARD_STAKE_TOKEN);
    tokenTypes[tokenCount] = TokenType.RewardStake;
    if (tokens[tokenCount] != address(0)) {
      tokenCount++;
    }

    for (uint256 i = 0; i < reserveList.length; i++) {
      address token = reserveList[i];
      DataTypes.ReserveData memory reserveData = pool.getReserveData(token);
      (bool isActive, , bool canBorrow, bool canBorrowStable) = reserveData.configuration.getFlagsMemory();
      canBorrow = isActive && canBorrow;
      canBorrowStable = canBorrowStable && canBorrow;

      if (includeAssets) {
        tokens[tokenCount] = token;
        tokenTypes[tokenCount] = TokenType.PoolAsset;
        tokenCount++;
      }

      tokens[tokenCount] = reserveData.depositTokenAddress;
      tokenTypes[tokenCount] = TokenType.Deposit;
      tokenCount++;

      if (reserveData.variableDebtTokenAddress != address(0)) {
        tokens[tokenCount] = reserveData.variableDebtTokenAddress;
        tokenTypes[tokenCount] = TokenType.VariableDebt;
        tokenCount++;
      }

      if (reserveData.stableDebtTokenAddress != address(0)) {
        tokens[tokenCount] = reserveData.stableDebtTokenAddress;
        tokenTypes[tokenCount] = TokenType.StableDebt;
        tokenCount++;
      }
    }

    for (uint256 i = 0; i < stakeList.length; i++) {
      tokens[tokenCount] = stakeList[i];
      tokenTypes[tokenCount] = TokenType.Stake;
      tokenCount++;
    }

    return (tokens, tokenCount, tokenTypes);
  }

  function getReserveConfigurationData(address asset)
    external
    view
    override
    returns (
      uint256 decimals,
      uint256 ltv,
      uint256 liquidationThreshold,
      uint256 liquidationBonus,
      uint256 reserveFactor,
      bool usageAsCollateralEnabled,
      bool borrowingEnabled,
      bool stableBorrowRateEnabled,
      bool isActive,
      bool isFrozen
    )
  {
    DataTypes.ReserveConfigurationMap memory configuration = ILendingPool(ADDRESS_PROVIDER.getLendingPool())
      .getConfiguration(asset);

    (ltv, liquidationThreshold, liquidationBonus, decimals, reserveFactor) = configuration.getParamsMemory();
    (isActive, isFrozen, borrowingEnabled, stableBorrowRateEnabled) = configuration.getFlagsMemory();

    usageAsCollateralEnabled = liquidationThreshold > 0;
  }

  function getReserveData(address asset)
    external
    view
    override
    returns (
      uint256 availableLiquidity,
      uint256 totalStableDebt,
      uint256 totalVariableDebt,
      uint256 liquidityRate,
      uint256 variableBorrowRate,
      uint256 stableBorrowRate,
      uint256 averageStableBorrowRate,
      uint256 liquidityIndex,
      uint256 variableBorrowIndex,
      uint40 lastUpdateTimestamp
    )
  {
    DataTypes.ReserveData memory reserve = ILendingPool(ADDRESS_PROVIDER.getLendingPool()).getReserveData(asset);

    availableLiquidity = IERC20Detailed(asset).balanceOf(reserve.depositTokenAddress);

    if (reserve.variableDebtTokenAddress != address(0)) {
      totalVariableDebt = IERC20Detailed(reserve.variableDebtTokenAddress).totalSupply();
    }

    if (reserve.stableDebtTokenAddress != address(0)) {
      totalStableDebt = IERC20Detailed(reserve.stableDebtTokenAddress).totalSupply();
      averageStableBorrowRate = IStableDebtToken(reserve.stableDebtTokenAddress).getAverageStableRate();
    }

    return (
      availableLiquidity,
      totalStableDebt,
      totalVariableDebt,
      reserve.currentLiquidityRate,
      reserve.currentVariableBorrowRate,
      reserve.currentStableBorrowRate,
      averageStableBorrowRate,
      reserve.liquidityIndex,
      reserve.variableBorrowIndex,
      reserve.lastUpdateTimestamp
    );
  }

  function getUserReserveData(address asset, address user)
    external
    view
    override
    returns (
      uint256 currentDepositBalance,
      uint256 currentStableDebt,
      uint256 currentVariableDebt,
      uint256 principalStableDebt,
      uint256 scaledVariableDebt,
      uint256 stableBorrowRate,
      uint256 liquidityRate,
      uint40 stableRateLastUpdated,
      bool usageAsCollateralEnabled
    )
  {
    DataTypes.ReserveData memory reserve = ILendingPool(ADDRESS_PROVIDER.getLendingPool()).getReserveData(asset);

    DataTypes.UserConfigurationMap memory userConfig = ILendingPool(ADDRESS_PROVIDER.getLendingPool())
      .getUserConfiguration(user);

    liquidityRate = reserve.currentLiquidityRate;
    usageAsCollateralEnabled = userConfig.isUsingAsCollateral(reserve.id);

    currentDepositBalance = IERC20Detailed(reserve.depositTokenAddress).balanceOf(user);

    if (reserve.variableDebtTokenAddress != address(0)) {
      currentVariableDebt = IERC20Detailed(reserve.variableDebtTokenAddress).balanceOf(user);
      scaledVariableDebt = IVariableDebtToken(reserve.variableDebtTokenAddress).scaledBalanceOf(user);
    }

    if (reserve.stableDebtTokenAddress != address(0)) {
      currentStableDebt = IERC20Detailed(reserve.stableDebtTokenAddress).balanceOf(user);
      principalStableDebt = IStableDebtToken(reserve.stableDebtTokenAddress).principalBalanceOf(user);
      stableBorrowRate = IStableDebtToken(reserve.stableDebtTokenAddress).getUserStableRate(user);
      stableRateLastUpdated = IStableDebtToken(reserve.stableDebtTokenAddress).getUserLastUpdated(user);
    }
  }

  function getReservesData(address user)
    external
    view
    override
    returns (
      AggregatedReserveData[] memory,
      UserReserveData[] memory,
      uint256
    )
  {
    ILendingPool lendingPool = ILendingPool(ADDRESS_PROVIDER.getLendingPool());
    IPriceOracleGetter oracle = IPriceOracleGetter(ADDRESS_PROVIDER.getPriceOracle());
    address[] memory reserves = lendingPool.getReservesList();
    DataTypes.UserConfigurationMap memory userConfig = lendingPool.getUserConfiguration(user);

    AggregatedReserveData[] memory reservesData = new AggregatedReserveData[](reserves.length);
    UserReserveData[] memory userReservesData = new UserReserveData[](user != address(0) ? reserves.length : 0);

    for (uint256 i = 0; i < reserves.length; i++) {
      AggregatedReserveData memory reserveData = reservesData[i];
      reserveData.underlyingAsset = reserves[i];
      reserveData.pricingAsset = reserveData.underlyingAsset;

      // reserve current state
      DataTypes.ReserveData memory baseData = lendingPool.getReserveData(reserveData.underlyingAsset);
      reserveData.liquidityIndex = baseData.liquidityIndex;
      reserveData.variableBorrowIndex = baseData.variableBorrowIndex;
      reserveData.liquidityRate = baseData.currentLiquidityRate;
      reserveData.variableBorrowRate = baseData.currentVariableBorrowRate;
      reserveData.stableBorrowRate = baseData.currentStableBorrowRate;
      reserveData.lastUpdateTimestamp = baseData.lastUpdateTimestamp;
      reserveData.depositTokenAddress = baseData.depositTokenAddress;
      reserveData.stableDebtTokenAddress = baseData.stableDebtTokenAddress;
      reserveData.variableDebtTokenAddress = baseData.variableDebtTokenAddress;
      reserveData.strategy = baseData.strategy;
      reserveData.isExternalStrategy = baseData.configuration.isExternalStrategyMemory();
      reserveData.priceInEth = oracle.getAssetPrice(reserveData.pricingAsset);

      reserveData.availableLiquidity = IERC20Detailed(reserveData.underlyingAsset).balanceOf(
        reserveData.depositTokenAddress
      );

      if (reserveData.variableDebtTokenAddress != address(0)) {
        reserveData.totalScaledVariableDebt = IVariableDebtToken(reserveData.variableDebtTokenAddress)
          .scaledTotalSupply();
      }

      if (reserveData.stableDebtTokenAddress != address(0)) {
        (
          reserveData.totalPrincipalStableDebt,
          reserveData.totalStableDebt,
          reserveData.averageStableRate,
          reserveData.stableDebtLastUpdateTimestamp
        ) = IStableDebtToken(reserveData.stableDebtTokenAddress).getSupplyData();
      }

      // reserve configuration

      // we're getting this info from the depositToken, because some of assets can be not compliant with ETC20Detailed
      reserveData.symbol = IERC20Detailed(reserveData.depositTokenAddress).symbol();
      reserveData.name = '';

      (
        reserveData.baseLTVasCollateral,
        reserveData.reserveLiquidationThreshold,
        reserveData.reserveLiquidationBonus,
        reserveData.decimals,
        reserveData.reserveFactor
      ) = baseData.configuration.getParamsMemory();
      (
        reserveData.isActive,
        reserveData.isFrozen,
        reserveData.borrowingEnabled,
        reserveData.stableBorrowRateEnabled
      ) = baseData.configuration.getFlagsMemory();
      reserveData.usageAsCollateralEnabled = reserveData.baseLTVasCollateral != 0;

      if (user != address(0)) {
        // user reserve data
        userReservesData[i].underlyingAsset = reserveData.underlyingAsset;
        userReservesData[i].scaledDepositTokenBalance = IDepositToken(reserveData.depositTokenAddress).scaledBalanceOf(
          user
        );
        userReservesData[i].usageAsCollateralEnabledOnUser = userConfig.isUsingAsCollateral(i);

        if (userConfig.isBorrowing(i)) {
          if (reserveData.variableDebtTokenAddress != address(0)) {
            userReservesData[i].scaledVariableDebt = IVariableDebtToken(reserveData.variableDebtTokenAddress)
              .scaledBalanceOf(user);
          }

          if (reserveData.stableDebtTokenAddress != address(0)) {
            userReservesData[i].principalStableDebt = IStableDebtToken(reserveData.stableDebtTokenAddress)
              .principalBalanceOf(user);

            if (userReservesData[i].principalStableDebt != 0) {
              userReservesData[i].stableBorrowRate = IStableDebtToken(reserveData.stableDebtTokenAddress)
                .getUserStableRate(user);
              userReservesData[i].stableBorrowLastUpdateTimestamp = IStableDebtToken(reserveData.stableDebtTokenAddress)
                .getUserLastUpdated(user);
            }
          }
        }
      }
    }
    return (reservesData, userReservesData, oracle.getAssetPrice(USD));
  }

  function _getAddress(uint256 flag) private view returns (address) {
    return ADDRESS_PROVIDER.getAddress(flag);
  }

  function getAddresses() external view override returns (Addresses memory data) {
    data.addressProvider = address(ADDRESS_PROVIDER);
    data.lendingPool = _getAddress(AccessFlags.LENDING_POOL);
    data.stakeConfigurator = _getAddress(AccessFlags.STAKE_CONFIGURATOR);
    data.rewardConfigurator = _getAddress(AccessFlags.REWARD_CONFIGURATOR);
    data.rewardController = _getAddress(AccessFlags.REWARD_CONTROLLER);
    data.wethGateway = _getAddress(AccessFlags.WETH_GATEWAY);
    data.priceOracle = _getAddress(AccessFlags.PRICE_ORACLE);
    data.lendingPriceOracle = _getAddress(AccessFlags.LENDING_RATE_ORACLE);
    data.rewardToken = _getAddress(AccessFlags.REWARD_TOKEN);
    data.rewardStake = _getAddress(AccessFlags.REWARD_STAKE_TOKEN);
    data.referralRegistry = _getAddress(AccessFlags.REFERRAL_REGISTRY);
  }

  function balanceOf(
    address user,
    address token,
    TokenType tokenType
  ) public view returns (TokenBalance memory r) {
    if (tokenType >= TokenType.Stake) {
      if (tokenType == TokenType.Stake) {
        (r.balance, r.unstakeWindowStart, r.unstakeWindowEnd) = IStakeToken(token).balanceAndCooldownOf(user);
        r.underlyingBalance = IStakeToken(token).balanceOfUnderlying(user);
        r.rewardedBalance = IStakeToken(token).rewardedBalanceOf(user);
      } else if (tokenType == TokenType.RewardStake) {
        r.balance = IERC20Detailed(token).balanceOf(user);
        (r.underlyingBalance, r.unstakeWindowStart) = ILockedUnderlyingBalance(token).balanceOfUnderlyingAndExpiry(
          user
        );
        r.unstakeWindowEnd = type(uint32).max;
      } else {
        r.underlyingBalance = r.balance = IERC20Detailed(token).balanceOf(user);
      }
    } else if (tokenType == TokenType.PoolAsset) {
      r.underlyingBalance = r.balance = token == ETH ? user.balance : IERC20Detailed(token).balanceOf(user);
    } else {
      r.underlyingBalance = r.balance = IERC20Detailed(token).balanceOf(user);
      r.rewardedBalance = IRewardedToken(token).rewardedBalanceOf(user);
    }
  }

  /**
   * @return balances - an array with the concatenation of balances for each user
   **/
  function batchBalanceOf(
    address[] calldata users,
    address[] calldata tokens,
    TokenType[] calldata tokenTypes,
    TokenType defType
  ) external view override returns (TokenBalance[] memory balances) {
    balances = new TokenBalance[](users.length * tokens.length);

    for (uint256 i = 0; i < users.length; i++) {
      for (uint256 j = 0; j < tokens.length; j++) {
        balances[i * tokens.length + j] = balanceOf(
          users[i],
          tokens[j],
          tokenTypes.length == 0 ? defType : tokenTypes[j]
        );
      }
    }

    return balances;
  }

  function explainReward(address holder, uint32 minDuration) external view returns (RewardExplained memory, uint32 at) {
    IRewardExplainer re = IRewardExplainer(_getAddress(AccessFlags.REWARD_CONTROLLER));
    at = uint32(block.timestamp) + minDuration;
    return (re.explainReward(holder, at), at);
  }

  function rewardPoolNames(address[] calldata pools, uint256 ignoreMask) external view returns (string[] memory names) {
    names = new string[](pools.length);
    for (uint256 i = 0; i < pools.length; (i, ignoreMask) = (i + 1, ignoreMask >> 1)) {
      if (ignoreMask & 1 != 0 || pools[i] == address(0)) {
        continue;
      }
      names[i] = IManagedRewardPool(pools[i]).getPoolName();
    }
    return names;
  }

  function getReserveTokensAddresses(address asset)
    external
    view
    returns (
      address depositTokenAddress, // ATTN! DO NOT rename - scripts rely on names
      address stableDebtTokenAddress,
      address variableDebtTokenAddress
    )
  {
    DataTypes.ReserveData memory reserve = ILendingPool(ADDRESS_PROVIDER.getLendingPool()).getReserveData(asset);
    return (reserve.depositTokenAddress, reserve.stableDebtTokenAddress, reserve.variableDebtTokenAddress);
  }
}
