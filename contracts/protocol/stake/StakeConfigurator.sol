// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

import '../../dependencies/openzeppelin/contracts/IERC20.sol';
import '../../tools/upgradeability/VersionedInitializable.sol';
import '../../access/interfaces/IMarketAccessController.sol';
import '../../interfaces/IDerivedToken.sol';
import '../../interfaces/IDepositToken.sol';
import '../../access/MarketAccessBitmask.sol';
import '../../access/AccessFlags.sol';
import '../../tools/upgradeability/IProxy.sol';
import '../../tools/upgradeability/ProxyAdmin.sol';
import './interfaces/IStakeConfigurator.sol';
import './interfaces/IInitializableStakeToken.sol';
import './interfaces/StakeTokenConfig.sol';
import './interfaces/IManagedStakeToken.sol';

contract StakeConfigurator is MarketAccessBitmask, VersionedInitializable, IStakeConfigurator {
  uint256 private constant CONFIGURATOR_REVISION = 3;

  mapping(uint256 => address) private _entries;
  uint256 private _entryCount;
  mapping(address => uint256) private _underlyings;

  ProxyAdmin private _proxies;
  uint256 private _legacyCount;

  constructor() MarketAccessBitmask(IMarketAccessController(address(0))) {}

  function getRevision() internal pure virtual override returns (uint256) {
    return CONFIGURATOR_REVISION;
  }

  // This initializer is invoked by AccessController.setAddressAsImpl
  function initialize(address addressesProvider) external initializer(CONFIGURATOR_REVISION) {
    _remoteAcl = IMarketAccessController(addressesProvider);
    if (address(_proxies) == address(0)) {
      _proxies = new ProxyAdmin();
      _legacyCount = _entryCount;
    }
  }

  function getProxyAdmin() public view returns (address) {
    return address(_proxies);
  }

  function list() public view override returns (address[] memory tokens) {
    return _list(_legacyCount);
  }

  function listAll() public view override returns (address[] memory tokens, uint256 genCount) {
    return (_list(0), _legacyCount);
  }

  function _list(uint256 base) internal view returns (address[] memory tokens) {
    if (_entryCount <= base) {
      return tokens;
    }
    tokens = new address[](_entryCount - base);
    base++;
    for (uint256 i = 0; i < tokens.length; i++) {
      tokens[i] = _entries[i + base];
    }
    return tokens;
  }

  function stakeTokenOf(address underlying) public view override returns (address) {
    uint256 i = _underlyings[underlying];
    if (i == 0) {
      return address(0);
    }
    return _entries[i];
  }

  function dataOf(address stakeToken) public view override returns (StakeTokenData memory data) {
    (data.config, data.stkTokenName, data.stkTokenSymbol) = IInitializableStakeToken(stakeToken)
      .initializedStakeTokenWith();
    data.token = stakeToken;

    return data;
  }

  function addStakeToken(address token) public aclHas(AccessFlags.STAKE_ADMIN) {
    require(token != address(0), 'unknown token');
    _addStakeToken(token, IDerivedToken(token).UNDERLYING_ASSET_ADDRESS());
  }

  function removeStakeTokenByUnderlying(address underlying) public aclHas(AccessFlags.STAKE_ADMIN) returns (bool) {
    require(underlying != address(0), 'unknown underlying');
    return _removeStakeToken(_underlyings[underlying], underlying);
  }

  function removeStakeToken(uint256 index) public aclHas(AccessFlags.STAKE_ADMIN) returns (bool) {
    return _removeStakeToken(index + 1, address(0));
  }

  function removeUnderlyings(address[] calldata underlyings) public aclHas(AccessFlags.STAKE_ADMIN) {
    for (uint256 i = underlyings.length; i > 0; ) {
      i--;
      _underlyings[underlyings[i]] = 0;
    }
  }

  function _removeStakeToken(uint256 i, address underlying) private returns (bool) {
    if (i == 0 || _entries[i] == address(0)) {
      return false;
    }

    emit StakeTokenRemoved(_entries[i], underlying);

    delete (_entries[i]);
    if (underlying == address(0)) {
      delete (_underlyings[underlying]);
    }
    return true;
  }

  function _addStakeToken(address token, address underlying) private {
    require(token != address(0), 'unknown token');
    require(underlying != address(0), 'unknown underlying');
    require(stakeTokenOf(underlying) == address(0), 'ambiguous underlying');

    _entryCount++;
    _entries[_entryCount] = token;
    _underlyings[underlying] = _entryCount;

    emit StakeTokenAdded(token, underlying);
  }

  function batchInitStakeTokens(InitStakeTokenData[] memory input) public aclHas(AccessFlags.STAKE_ADMIN) {
    for (uint256 i = 0; i < input.length; i++) {
      initStakeToken(input[i]);
    }
  }

  function initStakeToken(InitStakeTokenData memory input) private returns (address token) {
    StakeTokenConfig memory config = StakeTokenConfig(
      _remoteAcl,
      IERC20(input.stakedToken),
      IUnderlyingStrategy(input.strategy),
      input.cooldownPeriod,
      input.unstakePeriod,
      input.maxSlashable,
      input.stkTokenDecimals
    );

    bytes memory params = abi.encodeWithSelector(
      IInitializableStakeToken.initializeStakeToken.selector,
      config,
      input.stkTokenName,
      input.stkTokenSymbol
    );

    token = address(_remoteAcl.createProxy(address(_proxies), input.stakeTokenImpl, params));
    if (input.depositStake) {
      IDepositToken(input.stakedToken).addStakeOperator(token);
    }

    emit StakeTokenInitialized(token, input);

    _addStakeToken(token, input.stakedToken);

    return token;
  }

  function implementationOf(address token) external view returns (address) {
    return _proxies.getProxyImplementation(IProxy(token));
  }

  function updateStakeToken(UpdateStakeTokenData calldata input) external aclHas(AccessFlags.STAKE_ADMIN) {
    StakeTokenData memory data = dataOf(input.token);

    bytes memory params = abi.encodeWithSelector(
      IInitializableStakeToken.initializeStakeToken.selector,
      data.config,
      input.stkTokenName,
      input.stkTokenSymbol
    );

    _proxies.upgradeAndCall(IProxy(input.token), input.stakeTokenImpl, params);

    emit StakeTokenUpgraded(input.token, input);
  }

  function setCooldownForAll(uint32 cooldownPeriod, uint32 unstakePeriod)
    external
    override
    aclHas(AccessFlags.STAKE_ADMIN)
  {
    for (uint256 i = 1; i <= _entryCount; i++) {
      IManagedStakeToken(_entries[i]).setCooldown(cooldownPeriod, unstakePeriod);
    }
  }
}
