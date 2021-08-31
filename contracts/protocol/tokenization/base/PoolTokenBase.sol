// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

import '../../../tools/Errors.sol';
import '../../../tools/tokens/IERC20Details.sol';
import '../../../dependencies/openzeppelin/contracts/IERC20.sol';
import '../../../dependencies/openzeppelin/contracts/SafeMath.sol';
import '../../../interfaces/IPoolToken.sol';
import '../../../interfaces/IBalanceHook.sol';
import '../../../interfaces/ILendingPoolForTokens.sol';
import '../../../access/AccessHelper.sol';
import '../../../access/AccessFlags.sol';
import '../interfaces/IInitializablePoolToken.sol';
import '../interfaces/PoolTokenConfig.sol';

abstract contract PoolTokenBase is IERC20, IInitializablePoolToken, IPoolToken, IERC20Details {
  string private _name;
  string private _symbol;
  uint8 private _decimals;

  mapping(address => uint256) internal _balances;
  uint256 internal _totalSupply;

  ILendingPoolForTokens internal _pool;
  address internal _underlyingAsset;
  IBalanceHook private _incentivesController;

  constructor(
    string memory name_,
    string memory symbol_,
    uint8 decimals_
  ) {
    _name = name_;
    _symbol = symbol_;
    _decimals = decimals_;
  }

  function _initializeERC20(
    string memory name_,
    string memory symbol_,
    uint8 decimals_
  ) internal {
    _name = name_;
    _symbol = symbol_;
    _decimals = decimals_;
  }

  function name() public view override returns (string memory) {
    return _name;
  }

  function symbol() public view override returns (string memory) {
    return _symbol;
  }

  function decimals() public view override returns (uint8) {
    return _decimals;
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

  function _initializePoolToken(PoolTokenConfig memory config, bytes calldata params) internal {
    params;
    _pool = ILendingPoolForTokens(config.pool);
    _underlyingAsset = config.underlyingAsset;
  }

  function _emitInitialized(PoolTokenConfig memory config, bytes calldata params) internal {
    emit Initialized(
      config.underlyingAsset,
      address(config.pool),
      address(config.treasury),
      _name,
      _symbol,
      _decimals,
      params
    );
  }

  // solhint-disable-next-line func-name-mixedcase
  function UNDERLYING_ASSET_ADDRESS() public view override returns (address) {
    return _underlyingAsset;
  }

  // solhint-disable-next-line func-name-mixedcase
  function POOL() public view override returns (address) {
    return address(_pool);
  }

  function handleBalanceUpdate(
    address holder,
    uint256 oldBalance,
    uint256 newBalance,
    uint256 providerSupply
  ) internal virtual {
    IBalanceHook hook = _incentivesController;
    if (hook == IBalanceHook(address(0))) {
      return;
    }
    hook.handleBalanceUpdate(getIncentivesToken(), holder, oldBalance, newBalance, providerSupply);
  }

  function handleScaledBalanceUpdate(
    address holder,
    uint256 oldBalance,
    uint256 newBalance,
    uint256 providerSupply,
    uint256 scale
  ) internal {
    IBalanceHook hook = _incentivesController;
    if (hook == IBalanceHook(address(0))) {
      return;
    }
    hook.handleScaledBalanceUpdate(getIncentivesToken(), holder, oldBalance, newBalance, providerSupply, scale);
  }

  function getIncentivesToken() internal view virtual returns (address) {
    return address(this);
  }

  function _setIncentivesController(address hook) internal virtual {
    _incentivesController = IBalanceHook(hook);
  }

  function setIncentivesController(address hook) external override onlyRewardConfiguratorOrAdmin {
    _setIncentivesController(hook);
  }

  function getIncentivesController() public view override returns (address) {
    return address(_incentivesController);
  }

  function totalSupply() public view virtual override returns (uint256) {
    return _totalSupply;
  }

  function balanceOf(address account) public view virtual override returns (uint256) {
    return _balances[account];
  }

  function _mintBalance(
    address account,
    uint256 amount,
    uint256 scale
  ) internal {
    require(account != address(0), 'ERC20: mint to the zero address');
    _beforeTokenTransfer(address(0), account, amount);

    uint256 total = _totalSupply + amount;
    _totalSupply = total;

    uint256 oldAccountBalance = _balances[account];
    uint256 newAccountBalance = oldAccountBalance + amount;
    _balances[account] = newAccountBalance;

    handleScaledBalanceUpdate(account, oldAccountBalance, newAccountBalance, total, scale);
  }

  function _burnBalance(
    address account,
    uint256 amount,
    uint256 scale
  ) internal {
    require(account != address(0), 'ERC20: burn from the zero address');

    _beforeTokenTransfer(account, address(0), amount);

    uint256 total = _totalSupply - amount;
    _totalSupply = total;

    uint256 oldAccountBalance = _balances[account];
    uint256 newAccountBalance = SafeMath.sub(oldAccountBalance, amount, 'ERC20: burn amount exceeds balance');
    _balances[account] = newAccountBalance;

    handleScaledBalanceUpdate(account, oldAccountBalance, newAccountBalance, total, scale);
  }

  function _transferBalance(
    address sender,
    address recipient,
    uint256 amount,
    uint256 scale
  ) internal {
    require(sender != address(0), 'ERC20: transfer from the zero address');
    require(recipient != address(0), 'ERC20: transfer to the zero address');

    _beforeTokenTransfer(sender, recipient, amount);

    uint256 oldSenderBalance = _balances[sender];
    uint256 newSenderBalance = SafeMath.sub(oldSenderBalance, amount, 'ERC20: transfer amount exceeds balance');
    _balances[sender] = newSenderBalance;

    uint256 oldRecipientBalance = _balances[recipient];
    uint256 newRecipientBalance = oldRecipientBalance + amount;
    _balances[recipient] = newRecipientBalance;

    IBalanceHook hook = _incentivesController;
    if (address(hook) != address(0)) {
      address token = getIncentivesToken();
      uint256 currentTotalSupply = _totalSupply;

      hook.handleScaledBalanceUpdate(token, sender, oldSenderBalance, newSenderBalance, currentTotalSupply, scale);

      if (sender != recipient) {
        hook.handleScaledBalanceUpdate(
          token,
          recipient,
          oldRecipientBalance,
          newRecipientBalance,
          currentTotalSupply,
          scale
        );
      }
    }
  }

  function _beforeTokenTransfer(
    address from,
    address to,
    uint256 amount
  ) internal virtual {}
}
