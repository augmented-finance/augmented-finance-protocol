// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

import '../../../tools/Errors.sol';
import '../../../dependencies/openzeppelin/contracts/SafeMath.sol';
import '../../../dependencies/openzeppelin/contracts/IERC20.sol';
import '../../../interfaces/IPoolToken.sol';
import '../../../interfaces/IBalanceHook.sol';
import '../../../interfaces/ILendingPoolForTokens.sol';
import '../../../access/AccessHelper.sol';
import '../../../access/AccessFlags.sol';
import '../../../tools/tokens/ERC20DetailsBase.sol';
import '../interfaces/IInitializablePoolToken.sol';
import '../interfaces/PoolTokenConfig.sol';
import './IncentivisedTokenBase.sol';
import './RewardedTokenBase.sol';

abstract contract PoolTokenBase is IPoolToken, IInitializablePoolToken, RewardedTokenBase, ERC20DetailsBase {
  event Transfer(address indexed from, address indexed to, uint256 value);

  ILendingPoolForTokens internal _pool;
  address internal _underlyingAsset;

  constructor(address pool_, address underlyingAsset_) {
    _pool = ILendingPoolForTokens(pool_);
    _underlyingAsset = underlyingAsset_;
  }

  function _initializePoolToken(PoolTokenConfig memory config, bytes calldata params) internal virtual {
    params;
    _pool = ILendingPoolForTokens(config.pool);
    _underlyingAsset = config.underlyingAsset;
  }

  function _onlyLendingPool() private view {
    require(msg.sender == address(_pool), Errors.CALLER_NOT_LENDING_POOL);
  }

  modifier onlyLendingPool() {
    _onlyLendingPool();
    _;
  }

  function _onlyLendingPoolAdmin() private view {
    AccessHelper.requireAnyOf(
      _pool.getAccessController(),
      msg.sender,
      AccessFlags.POOL_ADMIN,
      Errors.CALLER_NOT_POOL_ADMIN
    );
  }

  modifier onlyLendingPoolAdmin() {
    _onlyLendingPoolAdmin();
    _;
  }

  function _onlyLendingPoolConfiguratorOrAdmin() private view {
    AccessHelper.requireAnyOf(
      _pool.getAccessController(),
      msg.sender,
      AccessFlags.POOL_ADMIN | AccessFlags.LENDING_POOL_CONFIGURATOR,
      Errors.CALLER_NOT_POOL_ADMIN
    );
  }

  modifier onlyLendingPoolConfiguratorOrAdmin() {
    _onlyLendingPoolConfiguratorOrAdmin();
    _;
  }

  function _onlyRewardConfiguratorOrAdmin() private view {
    AccessHelper.requireAnyOf(
      _pool.getAccessController(),
      msg.sender,
      AccessFlags.REWARD_CONFIG_ADMIN | AccessFlags.REWARD_CONFIGURATOR,
      Errors.CALLER_NOT_REWARD_CONFIG_ADMIN
    );
  }

  modifier onlyRewardConfiguratorOrAdmin() {
    _onlyRewardConfiguratorOrAdmin();
    _;
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
    _setIncentivesController(hook);
  }

  function _mintBalance(
    address account,
    uint256 amount,
    uint256 scale
  ) internal {
    require(account != address(0), 'ERC20: mint to the zero address');
    _beforeTokenTransfer(address(0), account, amount);
    _incrementBalance(account, amount, scale);
  }

  function _burnBalance(
    address account,
    uint256 amount,
    uint256 scale
  ) internal {
    require(account != address(0), 'ERC20: burn from the zero address');
    _beforeTokenTransfer(account, address(0), amount);
    _decrementBalance(account, amount, scale);
  }
}
