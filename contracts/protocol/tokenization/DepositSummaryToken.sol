// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

import '../../tools/Errors.sol';
import '../../interfaces/IRewardedToken.sol';
import '../../tools/tokens/ERC20NoTransferBase.sol';
import '../../tools/tokens/ERC20DetailsBase.sol';
import '../../tools/tokens/IERC20Detailed.sol';
import '../../access/MarketAccessBitmask.sol';
import '../../interfaces/ILendingPool.sol';
import '../../interfaces/IPriceOracle.sol';
import '../libraries/configuration/UserConfiguration.sol';

contract DepositSummaryToken is ERC20NoTransferBase, ERC20DetailsBase, MarketAccessBitmask {
  using UserConfiguration for DataTypes.UserConfigurationMap;

  constructor(
    address ac,
    string memory name_,
    string memory symbol_
  ) ERC20DetailsBase(name_, symbol_, 18) MarketAccessBitmask(IMarketAccessController(ac)) {}

  function _getPoolAssets()
    private
    view
    returns (
      ILendingPool lp,
      address[] memory assets,
      uint256[] memory prices
    )
  {
    lp = ILendingPool(_remoteAcl.getLendingPool());
    IPriceOracle po = IPriceOracle(_remoteAcl.getPriceOracle());
    assets = lp.getReservesList();
    prices = po.getAssetsPrices(assets);
    return (lp, assets, prices);
  }

  function balanceOf(address account) external view override returns (uint256 total) {
    (ILendingPool lp, address[] memory assets, uint256[] memory prices) = _getPoolAssets();
    for (uint256 i = assets.length; i > 0; ) {
      i--;
      DataTypes.ReserveData memory reserve = lp.getReserveData(assets[i]);
      address token = reserve.depositTokenAddress;
      total += (prices[i] * IRewardedToken(token).rewardedBalanceOf(account)) / (10**IERC20Detailed(token).decimals());
    }
    return total;
  }

  function totalSupply() external view override returns (uint256 total) {
    (ILendingPool lp, address[] memory assets, uint256[] memory prices) = _getPoolAssets();
    for (uint256 i = assets.length; i > 0; ) {
      i--;
      DataTypes.ReserveData memory reserve = lp.getReserveData(assets[i]);
      IERC20Detailed token = IERC20Detailed(reserve.depositTokenAddress);
      total += (prices[i] * token.totalSupply()) / (10**token.decimals());
    }
    return total;
  }

  function availableLiquidity() external view returns (uint256 total) {
    (ILendingPool lp, address[] memory assets, uint256[] memory prices) = _getPoolAssets();
    for (uint256 i = assets.length; i > 0; ) {
      i--;
      DataTypes.ReserveData memory reserve = lp.getReserveData(assets[i]);
      address token = reserve.depositTokenAddress;
      total += (prices[i] * IERC20Detailed(assets[i]).balanceOf(token)) / (10**IERC20Detailed(token).decimals());
    }
    return total;
  }
}
