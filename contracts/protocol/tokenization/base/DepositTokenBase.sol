// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import '../../../tools/Errors.sol';
import './PoolTokenBase.sol';

import '../../../dependencies/openzeppelin/contracts/IERC20.sol';
import '../../../dependencies/openzeppelin/contracts/ERC20Events.sol';

import '../../../dependencies/openzeppelin/contracts/SafeERC20.sol';
import '../../../interfaces/IDepositToken.sol';
import '../../../tools/math/WadRayMath.sol';
import '../../../misc/PermitForERC20.sol';

/// @dev Implementation of the interest bearing token for the Augmented Finance protocol
abstract contract DepositTokenBase is
  PoolTokenBase('', '', 0),
  PermitForERC20,
  ERC20Events,
  IDepositToken
{
  using WadRayMath for uint256;
  using SafeERC20 for IERC20;

  mapping(address => mapping(address => uint256)) private _allowances;
  address internal _treasury;

  function allowance(address owner, address spender)
    public
    view
    virtual
    override
    returns (uint256)
  {
    return _allowances[owner][spender];
  }

  function approve(address spender, uint256 amount) public virtual override returns (bool) {
    _approve(msg.sender, spender, amount);
    return true;
  }

  function increaseAllowance(address spender, uint256 addedValue) public override returns (bool) {
    _approve(msg.sender, spender, _allowances[msg.sender][spender].add(addedValue));
    return true;
  }

  function decreaseAllowance(address spender, uint256 subtValue) public override returns (bool) {
    _approve(
      msg.sender,
      spender,
      _allowances[msg.sender][spender].sub(subtValue, 'ERC20: decreased allowance below zero')
    );
    return true;
  }

  function burn(
    address user,
    address receiverOfUnderlying,
    uint256 amount,
    uint256 index
  ) external override onlyLendingPool {
    uint256 amountScaled = amount.rayDiv(index);
    require(amountScaled != 0, Errors.CT_INVALID_BURN_AMOUNT);
    _burnBalance(user, amountScaled, index);

    IERC20(_underlyingAsset).safeTransfer(receiverOfUnderlying, amount);

    emit Transfer(user, address(0), amount);
    emit Burn(user, receiverOfUnderlying, amount, index);
  }

  function mint(
    address user,
    uint256 amount,
    uint256 index
  ) external override onlyLendingPool returns (bool) {
    bool firstBalance = super.balanceOf(user) == 0;

    uint256 amountScaled = amount.rayDiv(index);
    require(amountScaled != 0, Errors.CT_INVALID_MINT_AMOUNT);
    _mintBalance(user, amountScaled, index);

    emit Transfer(address(0), user, amount);
    emit Mint(user, amount, index);

    return firstBalance;
  }

  function mintToTreasury(uint256 amount, uint256 index) external override onlyLendingPool {
    if (amount == 0) {
      return;
    }

    address treasury = _treasury;

    // Compared to the normal mint, we don't check for rounding errors.
    // The amount to mint can easily be very small since it is a fraction of the interest ccrued.
    // In that case, the treasury will experience a (very small) loss, but it
    // wont cause potentially valid transactions to fail.
    _mintBalance(treasury, amount.rayDiv(index), index);

    emit Transfer(address(0), treasury, amount);
    emit Mint(treasury, amount, index);
  }

  function transferOnLiquidation(
    address from,
    address to,
    uint256 value
  ) external override onlyLendingPool {
    // Being a normal transfer, the Transfer() and BalanceTransfer() are emitted
    // so no need to emit a specific event here
    _transfer(from, to, value, false);

    emit Transfer(from, to, value);
  }

  /// @dev Calculates the balance of the user: principal balance + interest generated by the principal
  function balanceOf(address user) public view override(IERC20, PoolTokenBase) returns (uint256) {
    return super.balanceOf(user).rayMul(_pool.getReserveNormalizedIncome(_underlyingAsset));
  }

  function scaledBalanceOf(address user) external view override returns (uint256) {
    return super.balanceOf(user);
  }

  function getScaledUserBalanceAndSupply(address user)
    external
    view
    override
    returns (uint256, uint256)
  {
    return (super.balanceOf(user), super.totalSupply());
  }

  function totalSupply() public view override(IERC20, PoolTokenBase) returns (uint256) {
    uint256 currentSupplyScaled = super.totalSupply();

    if (currentSupplyScaled == 0) {
      return 0;
    }

    return currentSupplyScaled.rayMul(_pool.getReserveNormalizedIncome(_underlyingAsset));
  }

  function scaledTotalSupply() public view virtual override returns (uint256) {
    return super.totalSupply();
  }

  /// @dev Returns the address of the treasury, receiving the fees on this depositToken
  function RESERVE_TREASURY_ADDRESS() public view returns (address) {
    return _treasury;
  }

  function transfer(address recipient, uint256 amount) public virtual override returns (bool) {
    _transfer(msg.sender, recipient, amount, true);
    emit Transfer(msg.sender, recipient, amount);
    return true;
  }

  function transferFrom(
    address sender,
    address recipient,
    uint256 amount
  ) public virtual override returns (bool) {
    _transfer(sender, recipient, amount, true);
    _approve(
      sender,
      msg.sender,
      _allowances[sender][msg.sender].sub(amount, 'ERC20: transfer amount exceeds allowance')
    );
    emit Transfer(sender, recipient, amount);
    return true;
  }

  function transferUnderlyingTo(address target, uint256 amount)
    external
    override
    onlyLendingPool
    returns (uint256)
  {
    IERC20(_underlyingAsset).safeTransfer(target, amount);
    return amount;
  }

  function handleRepayment(address user, uint256 amount) external override onlyLendingPool {}

  /**
   * @dev Validates and executes a transfer.
   * @param from The source address
   * @param to The destination address
   * @param amount The amount getting transferred
   * @param validate `true` if the transfer needs to be validated
   **/
  function _transfer(
    address from,
    address to,
    uint256 amount,
    bool validate
  ) internal {
    address underlyingAsset = _underlyingAsset;

    uint256 index = _pool.getReserveNormalizedIncome(underlyingAsset);

    uint256 fromBalanceBefore = super.balanceOf(from).rayMul(index);
    uint256 toBalanceBefore = super.balanceOf(to).rayMul(index);

    super._transferBalance(from, to, amount.rayDiv(index), index);

    if (validate) {
      _pool.finalizeTransfer(underlyingAsset, from, to, amount, fromBalanceBefore, toBalanceBefore);
    }

    emit BalanceTransfer(from, to, amount, index);
  }

  function _approveByPermit(
    address owner,
    address spender,
    uint256 amount
  ) internal override {
    _approve(owner, spender, amount);
  }

  function _getPermitDomainName() internal view override returns (bytes memory) {
    return bytes(super.name());
  }

  function _approve(
    address owner,
    address spender,
    uint256 amount
  ) internal virtual {
    require(owner != address(0), 'ERC20: approve from the zero address');
    require(spender != address(0), 'ERC20: approve to the zero address');

    _allowances[owner][spender] = amount;
    emit Approval(owner, spender, amount);
  }
}
