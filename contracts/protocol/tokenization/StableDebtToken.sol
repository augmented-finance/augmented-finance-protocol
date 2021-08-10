// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

import '../../tools/Errors.sol';
import '../../dependencies/openzeppelin/contracts/IERC20.sol';
import '../../dependencies/openzeppelin/contracts/SafeMath.sol';
import '../../tools/math/InterestMath.sol';
import '../../tools/math/WadRayMath.sol';
import '../../tools/upgradeability/VersionedInitializable.sol';
import '../../interfaces/IStableDebtToken.sol';
import '../../interfaces/IBalanceHook.sol';
import './interfaces/PoolTokenConfig.sol';
import './base/PoolTokenBase.sol';
import './base/DebtTokenBase.sol';

/**
 * @title StableDebtToken
 * @notice Implements a stable debt token to track the borrowing positions of users
 * at stable rate mode
 **/
contract StableDebtToken is DebtTokenBase, VersionedInitializable, IStableDebtToken {
  using SafeMath for uint256;
  using WadRayMath for uint256;

  uint256 private constant DEBT_TOKEN_REVISION = 0x1;

  uint256 internal _avgStableRate;
  mapping(address => uint40) internal _timestamps;
  mapping(address => uint256) internal _usersStableRate;
  uint40 internal _totalSupplyTimestamp;

  bool private _useScaledBalanceUpdate;

  function initialize(
    PoolTokenConfig memory config,
    string memory name,
    string memory symbol,
    uint8 decimals,
    bytes calldata params
  ) public override initializerRunAlways(DEBT_TOKEN_REVISION) {
    _initializeERC20(name, symbol, decimals);
    _initializePoolToken(config, name, symbol, decimals, params);
  }

  /**
   * @dev Gets the revision of the stable debt token implementation
   * @return The debt token implementation revision
   **/
  function getRevision() internal pure virtual override returns (uint256) {
    return DEBT_TOKEN_REVISION;
  }

  /**
   * @dev Returns the average stable rate across all the stable rate debt
   * @return the average stable rate
   **/
  function getAverageStableRate() external view virtual override returns (uint256) {
    return _avgStableRate;
  }

  /**
   * @dev Returns the timestamp of the last user action
   * @return The last update timestamp
   **/
  function getUserLastUpdated(address user) external view virtual override returns (uint40) {
    return _timestamps[user];
  }

  /**
   * @dev Returns the stable rate of the user
   * @param user The address of the user
   * @return The stable rate of user
   **/
  function getUserStableRate(address user) external view virtual override returns (uint256) {
    return _usersStableRate[user];
  }

  /**
   * @dev Calculates the current user debt balance
   * @return The accumulated debt of the user
   **/
  function balanceOf(address account)
    public
    view
    virtual
    override(IERC20, PoolTokenBase)
    returns (uint256)
  {
    uint256 accountBalance = super.balanceOf(account);
    if (accountBalance == 0) {
      return 0;
    }
    return accountBalance.rayMul(cumulatedInterest(account));
  }

  function cumulatedInterest(address account) public view virtual returns (uint256) {
    return
      InterestMath.calculateCompoundedInterest(_usersStableRate[account], _timestamps[account]);
  }

  struct MintLocalVars {
    uint256 previousSupply;
    uint256 nextSupply;
    uint256 amountInRay;
    uint256 newStableRate;
    uint256 currentAvgStableRate;
  }

  /**
   * @dev Mints debt token to the `onBehalfOf` address.
   * -  Only callable by the LendingPool
   * - The resulting rate is the weighted average between the rate of the new debt
   * and the rate of the previous debt
   * @param user The address receiving the borrowed underlying, being the delegatee in case
   * of credit delegate, or same as `onBehalfOf` otherwise
   * @param onBehalfOf The address receiving the debt tokens
   * @param amount The amount of debt tokens to mint
   * @param rate The rate of the debt being minted
   **/
  function mint(
    address user,
    address onBehalfOf,
    uint256 amount,
    uint256 rate
  ) external override onlyLendingPool returns (bool) {
    MintLocalVars memory vars;

    if (user != onBehalfOf) {
      _decreaseBorrowAllowance(onBehalfOf, user, amount);
    }

    (, uint256 currentBalance, uint256 balanceIncrease) = _calculateBalanceIncrease(onBehalfOf);

    vars.previousSupply = totalSupply();
    vars.currentAvgStableRate = _avgStableRate;
    vars.nextSupply = _totalSupply = vars.previousSupply.add(amount);

    vars.amountInRay = amount.wadToRay();

    vars.newStableRate = _usersStableRate[onBehalfOf]
      .rayMul(currentBalance.wadToRay())
      .add(vars.amountInRay.rayMul(rate))
      .rayDiv(currentBalance.add(amount).wadToRay());

    require(vars.newStableRate <= type(uint128).max, Errors.SDT_STABLE_DEBT_OVERFLOW);
    _usersStableRate[onBehalfOf] = vars.newStableRate;

    //solium-disable-next-line
    _totalSupplyTimestamp = _timestamps[onBehalfOf] = uint40(block.timestamp);

    // Calculates the updated average stable rate
    vars.currentAvgStableRate = _avgStableRate = vars
      .currentAvgStableRate
      .rayMul(vars.previousSupply.wadToRay())
      .add(rate.rayMul(vars.amountInRay))
      .rayDiv(vars.nextSupply.wadToRay());

    _mintWithTotal(onBehalfOf, amount.add(balanceIncrease), vars.nextSupply);

    emit Transfer(address(0), onBehalfOf, amount);

    emit Mint(
      user,
      onBehalfOf,
      amount,
      currentBalance,
      balanceIncrease,
      vars.newStableRate,
      vars.currentAvgStableRate,
      vars.nextSupply
    );

    return currentBalance == 0;
  }

  /**
   * @dev Burns debt of `user`
   * @param user The address of the user getting his debt burned
   * @param amount The amount of debt tokens getting burned
   **/
  function burn(address user, uint256 amount) external override onlyLendingPool {
    (, uint256 currentBalance, uint256 balanceIncrease) = _calculateBalanceIncrease(user);

    uint256 previousSupply = totalSupply();
    uint256 newAvgStableRate = 0;
    uint256 nextSupply = 0;
    uint256 userStableRate = _usersStableRate[user];

    // Since the total supply and each single user debt accrue separately,
    // there might be accumulation errors so that the last borrower repaying
    // mght actually try to repay more than the available debt supply.
    // In this case we simply set the total supply and the avg stable rate to 0
    if (previousSupply <= amount) {
      _avgStableRate = 0;
      _totalSupply = 0;
    } else {
      nextSupply = _totalSupply = previousSupply.sub(amount);
      uint256 firstTerm = _avgStableRate.rayMul(previousSupply.wadToRay());
      uint256 secondTerm = userStableRate.rayMul(amount.wadToRay());

      // For the same reason described above, when the last user is repaying it might
      // happen that user rate * user balance > avg rate * total supply. In that case,
      // we simply set the avg rate to 0
      if (secondTerm >= firstTerm) {
        newAvgStableRate = _avgStableRate = _totalSupply = 0;
      } else {
        newAvgStableRate = _avgStableRate = firstTerm.sub(secondTerm).rayDiv(nextSupply.wadToRay());
      }
    }

    if (amount == currentBalance) {
      _usersStableRate[user] = 0;
      _timestamps[user] = 0;
    } else {
      //solium-disable-next-line
      _timestamps[user] = uint40(block.timestamp);
    }
    //solium-disable-next-line
    _totalSupplyTimestamp = uint40(block.timestamp);

    if (balanceIncrease > amount) {
      uint256 amountToMint = balanceIncrease.sub(amount);
      _mintWithTotal(user, amountToMint, nextSupply);
      emit Mint(
        user,
        user,
        amountToMint,
        currentBalance,
        balanceIncrease,
        userStableRate,
        newAvgStableRate,
        nextSupply
      );
    } else {
      uint256 amountToBurn = amount.sub(balanceIncrease);
      _burnWithTotal(user, amountToBurn, nextSupply);
      emit Burn(user, amountToBurn, currentBalance, balanceIncrease, newAvgStableRate, nextSupply);
    }

    emit Transfer(user, address(0), amount);
  }

  /**
   * @dev Calculates the increase in balance since the last user interaction
   * @param user The address of the user for which the interest is being accumulated
   * @return The previous principal balance, the new principal balance and the balance increase
   **/
  function _calculateBalanceIncrease(address user)
    internal
    view
    returns (
      uint256,
      uint256,
      uint256
    )
  {
    uint256 previousPrincipalBalance = super.balanceOf(user);

    if (previousPrincipalBalance == 0) {
      return (0, 0, 0);
    }

    // Calculation of the accrued interest since the last accumulation
    uint256 balanceIncrease = balanceOf(user).sub(previousPrincipalBalance);

    return (
      previousPrincipalBalance,
      previousPrincipalBalance.add(balanceIncrease),
      balanceIncrease
    );
  }

  /// @dev Returns the principal and total supply, the average borrow rate and the last supply update timestamp
  function getSupplyData()
    public
    view
    override
    returns (
      uint256,
      uint256,
      uint256,
      uint40
    )
  {
    uint256 avgRate = _avgStableRate;
    return (super.totalSupply(), _calcTotalSupply(avgRate), avgRate, _totalSupplyTimestamp);
  }

  /// @dev Returns the the total supply and the average stable rate
  function getTotalSupplyAndAvgRate() public view override returns (uint256, uint256) {
    uint256 avgRate = _avgStableRate;
    return (_calcTotalSupply(avgRate), avgRate);
  }

  /// @dev Returns the total supply
  function totalSupply() public view override(IERC20, PoolTokenBase) returns (uint256) {
    return _calcTotalSupply(_avgStableRate);
  }

  /// @dev Returns the timestamp at which the total supply was updated
  function getTotalSupplyLastUpdated() public view override returns (uint40) {
    return _totalSupplyTimestamp;
  }

  /**
   * @dev Returns the principal debt balance of the user from
   * @param user The user's address
   * @return The debt balance of the user since the last burn/mint action
   **/
  function principalBalanceOf(address user) external view virtual override returns (uint256) {
    return super.balanceOf(user);
  }

  /**
   * @dev Calculates the total supply
   * @param avgRate The average rate at which the total supply increases
   * @return The debt balance of the user since the last burn/mint action
   **/
  function _calcTotalSupply(uint256 avgRate) internal view virtual returns (uint256) {
    uint256 principalSupply = super.totalSupply();

    if (principalSupply == 0) {
      return 0;
    }

    uint256 cumInterest = InterestMath.calculateCompoundedInterest(avgRate, _totalSupplyTimestamp);
    return principalSupply.rayMul(cumInterest);
  }

  /**
   * @dev Mints stable debt tokens to an user
   * @param account The account receiving the debt tokens
   * @param amount The amount being minted
   * @param newTotalSupply the total supply after the minting event
   **/
  function _mintWithTotal(
    address account,
    uint256 amount,
    uint256 newTotalSupply
  ) internal {
    uint256 oldAccountBalance = _balances[account];
    uint256 newAccountBalance = oldAccountBalance.add(amount);
    _balances[account] = newAccountBalance;

    balanceUpdate(account, oldAccountBalance, newAccountBalance, newTotalSupply);
  }

  /**
   * @dev Burns stable debt tokens of an user
   * @param account The user getting his debt burned
   * @param amount The amount being burned
   * @param newTotalSupply The total supply after the burning event
   **/
  function _burnWithTotal(
    address account,
    uint256 amount,
    uint256 newTotalSupply
  ) internal {
    uint256 oldAccountBalance = _balances[account];
    uint256 newAccountBalance = oldAccountBalance.sub(amount, Errors.SDT_BURN_EXCEEDS_BALANCE);
    _balances[account] = newAccountBalance;

    balanceUpdate(account, oldAccountBalance, newAccountBalance, newTotalSupply);
  }

  function _setIncentivesController(address hook) internal override {
    super._setIncentivesController(hook);
    _useScaledBalanceUpdate =
      (hook != address(0)) &&
      IBalanceHook(hook).isScaledBalanceUpdateNeeded();
  }

  function balanceUpdate(
    address holder,
    uint256 oldBalance,
    uint256 newBalance,
    uint256 providerSupply
  ) internal {
    if (!_useScaledBalanceUpdate) {
      super.handleBalanceUpdate(holder, oldBalance, newBalance, providerSupply);
    }

    if (address(getIncentivesController()) == address(0)) {
      return;
    }
    uint256 scale = cumulatedInterest(holder);
    super.handleScaledBalanceUpdate(holder, oldBalance, newBalance, providerSupply, scale);
  }
}
