// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;

interface IControllerAaveEcosystemReserve {
  function approve(
    address token,
    address recipient,
    uint256 amount
  ) external;
}
