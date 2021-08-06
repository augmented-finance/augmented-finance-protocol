// SPDX-License-Identifier: MIT
pragma solidity ^0.6.0;

import './IERC20WithEvents.sol';
import './SafeMath.sol';

/// @dev Implementation of the {IERC20} interface.
contract ERC20 is IERC20WithEvents {
  using SafeMath for uint256;

  mapping(address => uint256) private _balances;

  mapping(address => mapping(address => uint256)) private _allowances;

  uint256 private _totalSupply;

  string private _name;
  string private _symbol;
  uint8 private _decimals;

  /// @dev Sets the values for {name}, {symbol} and {decimals}.
  constructor(
    string memory name,
    string memory symbol,
    uint8 decimals
  ) public {
    _name = name;
    _symbol = symbol;
    _decimals = decimals;
  }

  function _initializeERC20(
    string memory name,
    string memory symbol,
    uint8 decimals
  ) internal {
    _name = name;
    _symbol = symbol;
    _decimals = decimals;
  }

  /// @dev Returns the name of the token.
  function name() public view returns (string memory) {
    return _name;
  }

  /// @dev Returns the symbol of the token, usually a shorter version of the
  function symbol() public view returns (string memory) {
    return _symbol;
  }

  /// @dev Returns the number of decimals used to get its user representation.
  function decimals() public view returns (uint8) {
    return _decimals;
  }

  /// @dev See {IERC20-totalSupply}.
  function totalSupply() public view override returns (uint256) {
    return _totalSupply;
  }

  /// @dev See {IERC20-balanceOf}.
  function balanceOf(address account) public view override returns (uint256) {
    return _balances[account];
  }

  /// @dev See {IERC20-transfer}.
  /// - `recipient` cannot be the zero address.
  function transfer(address recipient, uint256 amount) public virtual override returns (bool) {
    _transfer(msg.sender, recipient, amount);
    return true;
  }

  /// @dev See {IERC20-allowance}.
  function allowance(address owner, address spender)
    public
    view
    virtual
    override
    returns (uint256)
  {
    return _allowances[owner][spender];
  }

  /// @dev See {IERC20-approve}.
  /// - `spender` cannot be the zero address.
  function approve(address spender, uint256 amount) public virtual override returns (bool) {
    _approve(msg.sender, spender, amount);
    return true;
  }

  /// @dev See {IERC20-transferFrom}.
  /// - `sender` and `recipient` cannot be the zero address.
  function transferFrom(
    address sender,
    address recipient,
    uint256 amount
  ) public virtual override returns (bool) {
    _transfer(sender, recipient, amount);
    _approve(
      sender,
      msg.sender,
      _allowances[sender][msg.sender].sub(amount, 'ERC20: transfer amount exceeds allowance')
    );
    return true;
  }

  /// @dev Atomically increases the allowance granted to `spender` by the caller.
  /// - `spender` cannot be the zero address.
  function increaseAllowance(address spender, uint256 addedValue) public virtual returns (bool) {
    _approve(msg.sender, spender, _allowances[msg.sender][spender].add(addedValue));
    return true;
  }

  /// @dev Atomically decreases the allowance granted to `spender` by the caller.
  /// - `spender` cannot be the zero address.
  function decreaseAllowance(address spender, uint256 subtractedValue)
    public
    virtual
    returns (bool)
  {
    _approve(
      msg.sender,
      spender,
      _allowances[msg.sender][spender].sub(subtractedValue, 'ERC20: decreased allowance below zero')
    );
    return true;
  }

  /// @dev Moves tokens `amount` from `sender` to `recipient`.
  /// - both `sender` and `recipient` cannot be the zero address.
  function _transfer(
    address sender,
    address recipient,
    uint256 amount
  ) internal virtual {
    require(sender != address(0), 'ERC20: transfer from the zero address');
    require(recipient != address(0), 'ERC20: transfer to the zero address');

    _beforeTokenTransfer(sender, recipient, amount);

    _balances[sender] = _balances[sender].sub(amount, 'ERC20: transfer amount exceeds balance');
    _balances[recipient] = _balances[recipient].add(amount);
    emit Transfer(sender, recipient, amount);
  }

  /// @dev Creates `amount` tokens and assigns them to `account`, increasing
  /// - `to` cannot be the zero address.
  function _mint(address account, uint256 amount) internal virtual {
    require(account != address(0), 'ERC20: mint to the zero address');

    _beforeTokenTransfer(address(0), account, amount);

    _totalSupply = _totalSupply.add(amount);
    _balances[account] = _balances[account].add(amount);
    emit Transfer(address(0), account, amount);
  }

  /// @dev Destroys `amount` tokens from `account`, reducing the
  /// - `account` cannot be the zero address.
  function _burn(address account, uint256 amount) internal virtual {
    require(account != address(0), 'ERC20: burn from the zero address');

    _beforeTokenTransfer(account, address(0), amount);

    _balances[account] = _balances[account].sub(amount, 'ERC20: burn amount exceeds balance');
    _totalSupply = _totalSupply.sub(amount);
    emit Transfer(account, address(0), amount);
  }

  /// @dev Sets `amount` as the allowance of `spender` over the `owner`s tokens.
  /// - `owner` and `spender` cannot be the zero address.
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

  /// @dev Hook that is called before any transfer of tokens. This includes minting and burning.
  function _beforeTokenTransfer(
    address from,
    address to,
    uint256 amount
  ) internal virtual {}
}
