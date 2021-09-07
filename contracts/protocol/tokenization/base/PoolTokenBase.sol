// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

import '../../../tools/Errors.sol';
import '../../../dependencies/openzeppelin/contracts/IERC20.sol';
import '../../../tools/tokens/ERC20DetailsBase.sol';
import '../../../interfaces/IPoolToken.sol';
import '../../../interfaces/ILendingPoolForTokens.sol';
import '../../../interfaces/IRewardedToken.sol';
import '../../../access/AccessHelper.sol';
import '../../../access/AccessFlags.sol';
import '../../../access/MarketAccessBitmask.sol';
import '../../../access/interfaces/IMarketAccessController.sol';
import '../interfaces/IInitializablePoolToken.sol';
import '../interfaces/PoolTokenConfig.sol';

abstract contract PoolTokenBase is
  IERC20,
  IPoolToken,
  IInitializablePoolToken,
  IRewardedToken,
  ERC20DetailsBase,
  MarketAccessBitmaskMin
{
  using AccessHelper for IMarketAccessController;

  event Transfer(address indexed from, address indexed to, uint256 value);

  ILendingPoolForTokens internal _pool;
  address internal _underlyingAsset;

  constructor(address pool_, address underlyingAsset_)
    MarketAccessBitmaskMin(
      pool_ != address(0) ? ILendingPoolForTokens(pool_).getAccessController() : IMarketAccessController(address(0))
    )
  {
    _pool = ILendingPoolForTokens(pool_);
    _underlyingAsset = underlyingAsset_;
  }

  function _initializePoolToken(PoolTokenConfig memory config, bytes calldata params) internal virtual {
    params;
    _pool = ILendingPoolForTokens(config.pool);
    _underlyingAsset = config.underlyingAsset;
    _remoteAcl = ILendingPoolForTokens(config.pool).getAccessController();
  }

  function _onlyLendingPool() private view {
    require(msg.sender == address(_pool), Errors.CALLER_NOT_LENDING_POOL);
  }

  modifier onlyLendingPool() {
    _onlyLendingPool();
    _;
  }

  function _onlyLendingPoolConfiguratorOrAdmin() private view {
    _remoteAcl.requireAnyOf(
      msg.sender,
      AccessFlags.POOL_ADMIN | AccessFlags.LENDING_POOL_CONFIGURATOR,
      Errors.CALLER_NOT_POOL_ADMIN
    );
  }

  modifier onlyLendingPoolConfiguratorOrAdmin() {
    _onlyLendingPoolConfiguratorOrAdmin();
    _;
  }

  function updatePool() external override onlyLendingPoolConfiguratorOrAdmin {
    address pool = _remoteAcl.getLendingPool();
    require(pool != address(0), Errors.LENDING_POOL_REQUIRED);
    _pool = ILendingPoolForTokens(pool);
  }

  // solhint-disable-next-line func-name-mixedcase
  function UNDERLYING_ASSET_ADDRESS() public view override returns (address) {
    return _underlyingAsset;
  }

  // solhint-disable-next-line func-name-mixedcase
  function POOL() public view override returns (address) {
    return address(_pool);
  }

  function setIncentivesController(address hook) external override onlyRewardConfiguratorOrAdmin {
    internalSetIncentivesController(hook);
  }

  function internalBalanceOf(address account) internal view virtual returns (uint256);

  function internalBalanceAndFlagsOf(address account) internal view virtual returns (uint256, uint32);

  function internalSetFlagsOf(address account, uint32 flags) internal virtual;

  function internalSetIncentivesController(address hook) internal virtual;

  function totalSupply() public view virtual override returns (uint256) {
    return internalTotalSupply();
  }

  function internalTotalSupply() internal view virtual returns (uint256);

  function _mintBalance(
    address account,
    uint256 amount,
    uint256 scale
  ) internal {
    require(account != address(0), 'ERC20: mint to the zero address');
    _beforeTokenTransfer(address(0), account, amount);
    internalUpdateTotalSupply(internalTotalSupply() + amount);
    internalIncrementBalance(account, amount, scale);
  }

  function _burnBalance(
    address account,
    uint256 amount,
    uint256 minLimit,
    uint256 scale
  ) internal {
    require(account != address(0), 'ERC20: burn from the zero address');
    _beforeTokenTransfer(account, address(0), amount);
    internalUpdateTotalSupply(internalTotalSupply() - amount);
    internalDecrementBalance(account, amount, minLimit, scale);
  }

  function _transferBalance(
    address sender,
    address recipient,
    uint256 amount,
    uint256 senderMinLimit,
    uint256 scale
  ) internal {
    require(sender != address(0), 'ERC20: transfer from the zero address');
    require(recipient != address(0), 'ERC20: transfer to the zero address');

    _beforeTokenTransfer(sender, recipient, amount);
    if (sender != recipient) {
      // require(oldSenderBalance >= amount, 'ERC20: transfer amount exceeds balance');
      internalDecrementBalance(sender, amount, senderMinLimit, scale);
      internalIncrementBalance(recipient, amount, scale);
    }
  }

  function _incrementBalanceWithTotal(
    address account,
    uint256 amount,
    uint256 scale,
    uint256 total
  ) internal {
    internalUpdateTotalSupply(total);
    internalIncrementBalance(account, amount, scale);
  }

  function _decrementBalanceWithTotal(
    address account,
    uint256 amount,
    uint256 scale,
    uint256 total
  ) internal {
    internalUpdateTotalSupply(total);
    internalDecrementBalance(account, amount, 0, scale);
  }

  function _beforeTokenTransfer(
    address from,
    address to,
    uint256 amount
  ) internal virtual {}

  function internalIncrementBalance(
    address account,
    uint256 amount,
    uint256 scale
  ) internal virtual;

  function internalDecrementBalance(
    address account,
    uint256 amount,
    uint256 senderMinLimit,
    uint256 scale
  ) internal virtual;

  function internalUpdateTotalSupply(uint256 newTotal) internal virtual;
}
