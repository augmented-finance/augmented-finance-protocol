// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

import '../dependencies/openzeppelin/contracts/Address.sol';
import '../tools/SafeOwnable.sol';
import '../tools/Errors.sol';
import '../tools/math/BitUtils.sol';
import '../tools/upgradeability/TransparentProxy.sol';
import '../tools/upgradeability/IProxy.sol';
import './interfaces/IAccessController.sol';
import './interfaces/IManagedAccessController.sol';
import './AccessCallHelper.sol';

contract AccessController is SafeOwnable, IManagedAccessController {
  using BitUtils for uint256;

  AccessCallHelper private _callHelper;

  mapping(uint256 => address) private _addresses;
  mapping(address => uint256) private _masks;
  mapping(uint256 => address[]) private _grantees;
  uint256 private _nonSingletons;
  uint256 private _singletons;
  uint256 private _proxies;

  address private _tempAdmin;
  uint256 private _expiresAt;

  uint8 private constant anyRoleBlocked = 1;
  uint8 private constant anyRoleEnabled = 2;
  uint8 private _anyRoleMode;

  constructor(
    uint256 singletons,
    uint256 nonSingletons,
    uint256 proxies
  ) {
    require(singletons & nonSingletons == 0, 'mixed types');
    require(singletons & proxies == proxies, 'all proxies must be singletons');
    _singletons = singletons;
    _nonSingletons = nonSingletons;
    _proxies = proxies;
    _callHelper = new AccessCallHelper(address(this));
  }

  function _onlyAdmin() private view {
    require(
      msg.sender == owner() || (msg.sender == _tempAdmin && _expiresAt > block.number),
      Errors.TXT_OWNABLE_CALLER_NOT_OWNER
    );
  }

  modifier onlyAdmin() {
    _onlyAdmin();
    _;
  }

  function queryAccessControlMask(address addr, uint256 filter) external view override returns (uint256 flags) {
    flags = _masks[addr];
    if (filter == 0) {
      return flags;
    }
    return flags & filter;
  }

  function setTemporaryAdmin(address admin, uint32 expiryBlocks) external override onlyOwner {
    if (_tempAdmin != address(0)) {
      _revokeAllRoles(_tempAdmin);
    }
    if (admin != address(0)) {
      _expiresAt = block.number + expiryBlocks;
    }
    _tempAdmin = admin;
    emit TemporaryAdminAssigned(_tempAdmin, _expiresAt);
  }

  function getTemporaryAdmin() external view override returns (address admin, uint256 expiresAtBlock) {
    if (admin != address(0)) {
      return (_tempAdmin, _expiresAt);
    }
    return (address(0), 0);
  }

  /// @dev Renouncement has no time limit and can be done either by the temporary admin at any time, or by anyone after the expiry.
  function renounceTemporaryAdmin() external override {
    if (_tempAdmin == address(0)) {
      return;
    }
    if (msg.sender != _tempAdmin && _expiresAt > block.number) {
      return;
    }
    _revokeAllRoles(_tempAdmin);
    _tempAdmin = address(0);
    emit TemporaryAdminAssigned(address(0), 0);
  }

  function setAnyRoleMode(bool blockOrEnable) external onlyAdmin {
    require(_anyRoleMode != anyRoleBlocked);
    if (blockOrEnable) {
      _anyRoleMode = anyRoleEnabled;
      emit AnyRoleModeEnabled();
    } else {
      _anyRoleMode = anyRoleBlocked;
      emit AnyRoleModeBlocked();
    }
  }

  function grantRoles(address addr, uint256 flags) external onlyAdmin returns (uint256) {
    require(_singletons & flags == 0, 'singleton should use setAddress');
    return _grantRoles(addr, flags);
  }

  function grantAnyRoles(address addr, uint256 flags) external onlyAdmin returns (uint256) {
    require(_anyRoleMode == anyRoleEnabled);
    return _grantRoles(addr, flags);
  }

  function _grantRoles(address addr, uint256 flags) private returns (uint256) {
    uint256 m = _masks[addr];
    flags &= ~m;
    if (flags == 0) {
      return m;
    }

    _nonSingletons |= flags & ~_singletons;

    m |= flags;
    _masks[addr] = m;

    for (uint8 i = 0; i <= 255; i++) {
      uint256 mask = uint256(1) << i;
      if (mask & flags == 0) {
        if (mask > flags) {
          break;
        }
        continue;
      }
      address[] storage grantees = _grantees[mask];
      if (grantees.length == 0 || grantees[grantees.length - 1] != addr) {
        grantees.push(addr);
      }
    }

    emit RolesUpdated(addr, m);
    return m;
  }

  function revokeRoles(address addr, uint256 flags) external onlyAdmin returns (uint256) {
    require(_singletons & flags == 0, 'singleton should use setAddress');

    return _revokeRoles(addr, flags);
  }

  function revokeAllRoles(address addr) external onlyAdmin returns (uint256) {
    return _revokeAllRoles(addr);
  }

  function _revokeAllRoles(address addr) private returns (uint256) {
    uint256 m = _masks[addr];
    if (m == 0) {
      return 0;
    }
    delete (_masks[addr]);
    emit RolesUpdated(addr, 0);

    uint256 flags = m & _singletons;
    if (flags == 0) {
      return m;
    }

    for (uint8 i = 0; i <= 255; i++) {
      uint256 mask = uint256(1) << i;
      if (mask & flags == 0) {
        if (mask > flags) {
          break;
        }
        continue;
      }
      if (_addresses[mask] == addr) {
        delete (_addresses[mask]);
      }
    }
    return m;
  }

  function _revokeRoles(address addr, uint256 flags) private returns (uint256) {
    uint256 m = _masks[addr];
    if (m & flags != 0) {
      m &= ~flags;
      _masks[addr] = m;
      emit RolesUpdated(addr, m);
    }
    return m;
  }

  function revokeRolesFromAll(uint256 flags, uint256 limit) external onlyAdmin returns (bool all) {
    all = true;

    for (uint8 i = 0; i <= 255; i++) {
      uint256 mask = uint256(1) << i;
      if (mask & flags == 0) {
        if (mask > flags) {
          break;
        }
        continue;
      }
      if (mask & _singletons != 0 && _addresses[mask] != address(0)) {
        delete (_addresses[mask]);
        emit AddressSet(mask, address(0), _proxies & mask != 0);
      }

      if (!all) {
        continue;
      }

      address[] storage grantees = _grantees[mask];
      for (uint256 j = grantees.length; j > 0; ) {
        j--;
        if (limit == 0) {
          all = false;
          break;
        }
        limit--;
        _revokeRoles(grantees[j], mask);
        grantees.pop();
      }
    }
    return all;
  }

  function roleGrantees(uint256 id) external view returns (address[] memory addrList) {
    require(id.isPowerOf2nz(), 'only one role is allowed');

    if (_singletons & id == 0) {
      return _grantees[id];
    }

    address singleton = _addresses[id];
    if (singleton == address(0)) {
      return _grantees[id];
    }

    address[] storage grantees = _grantees[id];

    addrList = new address[](1 + grantees.length);
    addrList[0] = singleton;
    for (uint256 i = 1; i < addrList.length; i++) {
      addrList[i] = grantees[i - 1];
    }
    return addrList;
  }

  function roleActiveGrantees(uint256 id) external view returns (address[] memory addrList, uint256 count) {
    require(id.isPowerOf2nz(), 'only one role is allowed');

    address addr;
    if (_singletons & id != 0) {
      addr = _addresses[id];
    }

    address[] storage grantees = _grantees[id];

    if (addr == address(0)) {
      addrList = new address[](grantees.length);
    } else {
      addrList = new address[](1 + grantees.length);
      addrList[0] = addr;
      count++;
    }

    for (uint256 i = 0; i < grantees.length; i++) {
      addr = grantees[i];
      if (_masks[addr] & id != 0) {
        addrList[count] = addr;
        count++;
      }
    }
    return (addrList, count);
  }

  /**
   * @dev Sets a sigleton address, replaces previous value
   * IMPORTANT Use this function carefully, as it does a hard replacement
   * @param id The id
   * @param newAddress The address to set
   */
  function setAddress(uint256 id, address newAddress) public override onlyAdmin {
    require(_proxies & id == 0, 'setAddressAsProxy is required');
    _internalSetAddress(id, newAddress);
    emit AddressSet(id, newAddress, false);
  }

  function _internalSetAddress(uint256 id, address newAddress) private {
    require(id.isPowerOf2nz(), 'invalid singleton id');
    if (_singletons & id == 0) {
      require(_nonSingletons & id == 0, 'id is not a singleton');
      _singletons |= id;
    }

    address prev = _addresses[id];
    if (prev != address(0)) {
      _masks[prev] = _masks[prev] & ~id;
    }
    if (newAddress != address(0)) {
      require(Address.isContract(newAddress), 'must be contract');
      _masks[newAddress] = _masks[newAddress] | id;
    }
    _addresses[id] = newAddress;
  }

  /**
   * @dev Returns a singleton address by id
   * @return addr The address
   */
  function getAddress(uint256 id) public view override returns (address addr) {
    addr = _addresses[id];

    if (addr == address(0)) {
      require(id.isPowerOf2nz(), 'invalid singleton id');
      require((_singletons & id != 0) || (_nonSingletons & id == 0), 'id is not a singleton');
    }
    return addr;
  }

  function isAddress(uint256 id, address addr) public view returns (bool) {
    // require(id.isPowerOf2nz(), 'only singleton id is accepted');
    return _masks[addr] & id != 0;
  }

  function markProxies(uint256 id) external onlyAdmin {
    _proxies |= id;
  }

  function unmarkProxies(uint256 id) external onlyAdmin {
    _proxies &= ~id;
  }

  /**
   * @dev General function to update the implementation of a proxy registered with
   * certain `id`. If there is no proxy registered, it will instantiate one and
   * set as implementation the `implAddress`
   * @param id The id
   * @param implAddress The address of the new implementation
   */
  function setAddressAsProxy(uint256 id, address implAddress) public override onlyAdmin {
    _updateImpl(id, implAddress, abi.encodeWithSignature('initialize(address)', address(this)));
    emit AddressSet(id, implAddress, true);
  }

  function setAddressAsProxyWithInit(
    uint256 id,
    address implAddress,
    bytes calldata params
  ) public override onlyAdmin {
    _updateImpl(id, implAddress, params);
    emit AddressSet(id, implAddress, true);
  }

  /**
   * @dev Internal function to update the implementation of a specific proxied component of the protocol
   * - If there is no proxy registered in the given `id`, it creates the proxy setting `newAdress`
   *   as implementation and calls a function on the proxy.
   * - If there is already a proxy registered, it updates the implementation to `newAddress` by
   *   the upgradeToAndCall() of the proxy.
   * @param id The id of the proxy to be updated
   * @param newAddress The address of the new implementation
   * @param params The address of the new implementation
   **/
  function _updateImpl(
    uint256 id,
    address newAddress,
    bytes memory params
  ) private {
    require(id.isPowerOf2nz(), 'invalid singleton id');
    address payable proxyAddress = payable(getAddress(id));

    if (proxyAddress != address(0)) {
      require(_proxies & id != 0, 'use of setAddress is required');
      TransparentProxy(proxyAddress).upgradeToAndCall(newAddress, params);
      return;
    }

    proxyAddress = payable(address(_createProxy(address(this), newAddress, params)));
    _internalSetAddress(id, proxyAddress);
    _proxies |= id;
    emit ProxyCreated(id, proxyAddress);
  }

  function _createProxy(
    address adminAddress,
    address implAddress,
    bytes memory params
  ) private returns (TransparentProxy) {
    TransparentProxy proxy = new TransparentProxy(adminAddress, implAddress, params);
    return proxy;
  }

  function createProxy(
    address adminAddress,
    address implAddress,
    bytes calldata params
  ) public override returns (IProxy) {
    return _createProxy(adminAddress, implAddress, params);
  }

  function directCallWithRoles(
    uint256 flags,
    address addr,
    bytes calldata data
  ) external override onlyAdmin returns (bytes memory result) {
    require(addr != address(this) && Address.isContract(addr), 'must be another contract');

    (bool restoreMask, uint256 oldMask) = _beforeDirectCallWithRoles(flags, addr);

    result = Address.functionCall(addr, data);

    if (restoreMask) {
      _afterDirectCallWithRoles(addr, oldMask);
    }
    return result;
  }

  function _beforeDirectCallWithRoles(uint256 flags, address addr) private returns (bool restoreMask, uint256 oldMask) {
    if (_singletons & flags != 0) {
      require(_anyRoleMode == anyRoleEnabled, 'singleton should use setAddress');
      _nonSingletons |= flags & ~_singletons;
    } else {
      _nonSingletons |= flags;
    }

    oldMask = _masks[addr];
    if (flags & ~oldMask != 0) {
      _masks[addr] = oldMask | flags;
      emit RolesUpdated(addr, oldMask | flags);
      return (true, oldMask);
    }
    return (false, oldMask);
  }

  function _afterDirectCallWithRoles(address addr, uint256 oldMask) private {
    _masks[addr] = oldMask;
    emit RolesUpdated(addr, oldMask);
  }

  function callWithRoles(CallParams[] calldata params) external override onlyAdmin returns (bytes[] memory results) {
    address callHelper = address(_callHelper);

    results = new bytes[](params.length);

    for (uint256 i = 0; i < params.length; i++) {
      (bool restoreMask, ) = _beforeDirectCallWithRoles(params[i].accessFlags, callHelper);

      address callAddr = params[i].callAddr == address(0) ? getAddress(params[i].callFlag) : params[i].callAddr;
      results[i] = AccessCallHelper(callHelper).doCall(callAddr, params[i].callData);

      if (restoreMask) {
        _afterDirectCallWithRoles(callHelper, 0); // call helper can't have any default roles
      }
    }
    return results;
  }
}
