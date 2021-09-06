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
contract StableDebtToken is IStableDebtToken, DebtTokenBase, VersionedInitializable {
  using WadRayMath for uint256;

  constructor() PoolTokenBase(address(0), address(0)) ERC20DetailsBase('', '', 0) {}

  uint256 private constant DEBT_TOKEN_REVISION = 0x1;

  uint256 internal _avgStableRate;
  mapping(address => uint40) internal _timestamps;
  mapping(address => uint256) internal _usersStableRate;
  uint40 internal _totalSupplyTimestamp;

  function initialize(
    PoolTokenConfig calldata config,
    string calldata name,
    string calldata symbol,
    bytes calldata params
  ) external override initializerRunAlways(DEBT_TOKEN_REVISION) {
    if (isRevisionInitialized(DEBT_TOKEN_REVISION)) {
      _initializeERC20(name, symbol, super.decimals());
    } else {
      _initializeERC20(name, symbol, config.underlyingDecimals);
      _initializePoolToken(config, params);
    }

    emit Initialized(
      config.underlyingAsset,
      address(config.pool),
      address(0),
      super.name(),
      super.symbol(),
      super.decimals(),
      params
    );
  }

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

  function balanceOf(address account) public view virtual override returns (uint256) {
    uint256 scaledBalance = internalBalanceOf(account);
    if (scaledBalance == 0) {
      return 0;
    }
    return scaledBalance.rayMul(cumulatedInterest(account));
  }

  function rewardedBalanceOf(address user) external view override returns (uint256) {
    return balanceOf(user);
  }

  function cumulatedInterest(address account) public view virtual returns (uint256) {
    return InterestMath.calculateCompoundedInterest(_usersStableRate[account], _timestamps[account]);
  }

  struct MintLocalVars {
    uint256 previousSupply;
    uint256 nextSupply;
    uint256 newStableRate;
    uint256 currentAvgStableRate;
  }

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
    vars.nextSupply = vars.previousSupply + amount;

    uint256 weightedRate = rate.wadMul(amount);

    vars.newStableRate = (_usersStableRate[onBehalfOf].wadMul(currentBalance) + weightedRate).wadDiv(
      currentBalance + amount
    );

    require(vars.newStableRate <= type(uint128).max, Errors.SDT_STABLE_DEBT_OVERFLOW);
    _usersStableRate[onBehalfOf] = vars.newStableRate;

    _totalSupplyTimestamp = _timestamps[onBehalfOf] = uint40(block.timestamp);

    // Calculates the updated average stable rate
    vars.currentAvgStableRate = _avgStableRate = (vars.currentAvgStableRate.wadMul(vars.previousSupply) + weightedRate)
      .wadDiv(vars.nextSupply);

    _mintWithTotal(onBehalfOf, amount + balanceIncrease, vars.nextSupply);

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
    emit Transfer(address(0), onBehalfOf, amount);

    return currentBalance == 0;
  }

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
    } else {
      nextSupply = previousSupply - amount;
      uint256 firstTerm = _avgStableRate.rayMul(previousSupply.wadToRay());
      uint256 secondTerm = userStableRate.rayMul(amount.wadToRay());

      // For the same reason described above, when the last user is repaying it might
      // happen that user rate * user balance > avg rate * total supply. In that case,
      // we simply set the avg rate to 0
      if (secondTerm >= firstTerm) {
        newAvgStableRate = _avgStableRate = nextSupply = 0;
      } else {
        newAvgStableRate = _avgStableRate = (firstTerm - secondTerm).rayDiv(nextSupply.wadToRay());
      }
    }

    if (amount == currentBalance) {
      _usersStableRate[user] = 0;
      _timestamps[user] = 0;
    } else {
      _timestamps[user] = uint40(block.timestamp);
    }
    _totalSupplyTimestamp = uint40(block.timestamp);

    if (balanceIncrease > amount) {
      uint256 amountToMint = balanceIncrease - amount;
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
      uint256 amountToBurn = amount - balanceIncrease;
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
    uint256 previousPrincipalBalance = internalBalanceOf(user);
    if (previousPrincipalBalance == 0) {
      return (0, 0, 0);
    }

    // Calculation of the accrued interest since the last accumulation
    uint256 balanceIncrease = balanceOf(user) - previousPrincipalBalance;

    return (previousPrincipalBalance, previousPrincipalBalance + balanceIncrease, balanceIncrease);
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
  function totalSupply() public view override returns (uint256) {
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
    return internalBalanceOf(user);
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
  ) private {
    _incrementBalanceWithTotal(account, amount, WadRayMath.RAY, newTotalSupply);
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
  ) private {
    _decrementBalanceWithTotal(account, amount, WadRayMath.RAY, newTotalSupply);
  }
}
