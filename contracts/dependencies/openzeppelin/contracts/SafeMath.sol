// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;

/// @dev Wrappers over Solidity's arithmetic operations with added overflow checks.
library SafeMath {
  /// @dev Returns the addition of two unsigned integers, reverting on overflow.
  function add(uint256 a, uint256 b) internal pure returns (uint256 c) {
    c = a + b;
    require(c >= a, 'SafeMath: addition overflow');
  }

  /// @dev Returns the subtraction of two unsigned integers, reverting on overflow (when the result is negative).
  function sub(uint256 a, uint256 b) internal pure returns (uint256) {
    return sub(a, b, 'SafeMath: subtraction overflow');
  }

  /// @dev Returns the subtraction of two unsigned integers, reverting with custom message on overflow (when the result is negative).
  function sub(
    uint256 a,
    uint256 b,
    string memory errMsg
  ) internal pure returns (uint256) {
    require(b <= a, errMsg);
    return a - b;
  }

  /// @dev Returns the multiplication of two unsigned integers, reverting on overflow.
  function mul(uint256 a, uint256 b) internal pure returns (uint256 c) {
    // Gas optimization: this is cheaper than requiring 'a' not being zero, but the
    // benefit is lost if 'b' is also tested.
    // See: https://github.com/OpenZeppelin/openzeppelin-contracts/pull/522
    if (a == 0) {
      return 0;
    }
    c = a * b;
    require(c / a == b, 'SafeMath: multiplication overflow');
  }

  /// @dev Returns the integer division of two unsigned integers. Reverts on division by zero. The result is rounded towards zero.
  function div(uint256 a, uint256 b) internal pure returns (uint256) {
    return div(a, b, 'SafeMath: division by zero');
  }

  /// @dev Returns the integer division of two unsigned integers. Reverts with custom message on division by zero. The result is rounded towards zero.
  function div(
    uint256 a,
    uint256 b,
    string memory errMsg
  ) internal pure returns (uint256 c) {
    // Solidity only automatically asserts when dividing by 0
    require(b > 0, errMsg);
    c = a / b;
  }

  /// @dev Returns the remainder of dividing two unsigned integers. (unsigned integer modulo), Reverts when dividing by zero.
  function mod(uint256 a, uint256 b) internal pure returns (uint256) {
    return mod(a, b, 'SafeMath: modulo by zero');
  }

  /// @dev Returns the remainder of dividing two unsigned integers. (unsigned integer modulo), Reverts with custom message when dividing by zero.
  function mod(
    uint256 a,
    uint256 b,
    string memory errMsg
  ) internal pure returns (uint256) {
    require(b != 0, errMsg);
    return a % b;
  }
}
