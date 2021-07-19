import BigNumber from 'bignumber.js';
import { ITokenNames } from './types';

// ----------------
// MATH
// ----------------
export const DAY = 60 * 60 * 24;
export const WEEK = 7 * DAY;
export const MAX_LOCKER_PERIOD = 4 * 52 * WEEK;
export const PERCENTAGE_FACTOR = '10000';
export const HALF_PERCENTAGE = '5000';
export const PERC_100 = Number(PERCENTAGE_FACTOR);
export const WAD_NUM = Math.pow(10, 18);
export const WAD = WAD_NUM.toString();
export const HALF_WAD = new BigNumber(WAD).multipliedBy(0.5).toString();
export const RAY = new BigNumber(10).exponentiatedBy(27).toFixed();
export const RAY_PER_WEEK = new BigNumber(10).exponentiatedBy(27).dividedBy(WEEK).toFixed(0);
export const HALF_RAY = new BigNumber(RAY).multipliedBy(0.5).toFixed();
export const WAD_RAY_RATIO_NUM = Math.pow(10, 9);
export const WAD_RAY_RATIO = WAD_RAY_RATIO_NUM.toString();
export const oneEther = new BigNumber(Math.pow(10, 18));
export const oneRay = new BigNumber(Math.pow(10, 27));
export const RAY_100 = oneRay.multipliedBy(100).toFixed();
export const RAY_10000 = oneRay.multipliedBy(10000).toFixed();
export const MAX_UINT_AMOUNT =
  '115792089237316195423570985008687907853269984665640564039457584007913129639935';
export const ONE_YEAR = '31536000';
export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
export const ONE_ADDRESS = '0x0000000000000000000000000000000000000001';
// ----------------
// PROTOCOL GLOBAL PARAMS
// ----------------
export const OPTIMAL_UTILIZATION_RATE = new BigNumber(0.8).times(RAY);
export const EXCESS_UTILIZATION_RATE = new BigNumber(0.2).times(RAY);
export const APPROVAL_AMOUNT_LENDING_POOL = '1000000000000000000000000000';
export const TOKEN_DISTRIBUTOR_PERCENTAGE_BASE = '10000';
export const MOCK_USD_PRICE_IN_WEI = '5848466240000000';
export const USD_ADDRESS = '0x10F7Fc1F91Ba351f9C629c5947AD69bD03C05b96';
export const AAVE_REFERRAL = '0';

export const MOCK_CHAINLINK_AGGREGATORS_PRICES = {
  AAVE: oneEther.multipliedBy('0.003620948469').toFixed(),
  DAI: oneEther.multipliedBy('0.00369068412860').toFixed(),
  LINK: oneEther.multipliedBy('0.009955').toFixed(),
  USDC: oneEther.multipliedBy('0.00367714136416').toFixed(),
  USDT: oneEther.multipliedBy('0.00369068412860').toFixed(),
  WETH: oneEther.toFixed(),
  WBTC: oneEther.multipliedBy('47.332685').toFixed(),
  USD: '5848466240000000',
};

export const DefaultTokenNames: ITokenNames = {
  DepositTokenNamePrefix: 'Augmented deposit',
  StableDebtTokenNamePrefix: 'Augmented stable debt',
  VariableDebtTokenNamePrefix: 'Augmented debt',
  StakeTokenNamePrefix: 'Augmented stake',

  SymbolPrefix: '',
  DepositSymbolPrefix: 'ag',
  StableDebtSymbolPrefix: 'ags',
  VariableDebtSymbolPrefix: 'agv',
  StakeSymbolPrefix: 'xag',

  RewardTokenName: 'Augmented reward',
  RewardTokenSymbol: 'AGF',

  RewardStakeTokenName: 'Augmented booster',
  RewardStakeTokenSymbol: 'xAGF',
};
