import { ethers } from 'ethers';

export enum AccessFlags {
  EMERGENCY_ADMIN = 1 << 0,
  POOL_ADMIN = 1 << 1,
  TREASURY_ADMIN = 1 << 2,
  REWARD_CONFIG_ADMIN = 1 << 3,
  REWARD_RATE_ADMIN = 1 << 4,
  STAKE_ADMIN = 1 << 5,
  REFERRAL_ADMIN = 1 << 6,
  LENDING_RATE_ADMIN = 1 << 7,
  SWEEP_ADMIN = 1 << 8,
  ORACLE_ADMIN = 1 << 9,

  LIQUIDITY_CONTROLLER = 1 << 15, // can slash & pause stakes

  LENDING_POOL = 1 << 16, // use proxy
  LENDING_POOL_CONFIGURATOR = 1 << 17, // use proxy

  PRICE_ORACLE = 1 << 19,
  LENDING_RATE_ORACLE = 1 << 20,
  TREASURY = 1 << 21, // use proxy

  REWARD_TOKEN = 1 << 22, // use proxy
  REWARD_STAKE_TOKEN = 1 << 23, // use proxy
  REWARD_CONTROLLER = 1 << 24,
  REWARD_CONFIGURATOR = 1 << 25, // use proxy

  STAKE_CONFIGURATOR = 1 << 26, // use proxy

  REFERRAL_REGISTRY = 1 << 27,
  WETH_GATEWAY = 1 << 27,
  DATA_HELPER = 1 << 29,
}

export const ACCESS_REWARD_MINT = ethers.BigNumber.from(2).pow(64);
export const ACCESS_REWARD_BURN = ethers.BigNumber.from(2).pow(65);
