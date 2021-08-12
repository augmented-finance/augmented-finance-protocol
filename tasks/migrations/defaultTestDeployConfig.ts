import { RAY } from '../../helpers/constants';

// mainnet addresses for fork tests
export const ADAI_ADDRESS = '0x028171bca77440897b824ca71d1c56cac55b68a3';
export const CDAI_ADDRESS = '0x5d3a536E4D6DbD6114cc1Ead35777bAB948E3643';
export const DAI_ADDRESS = '0x6b175474e89094c44da98b954eedeac495271d0f';
export const aDaiWhaleONE = '0x4deb3edd991cfd2fcdaa6dcfe5f1743f6e7d16a6';
export const aDaiWhaleTWO = '0x3ddfa8ec3052539b6c9549f12cea2c295cff5296';
export const aDaiWhaleTHREE = '0x449f284c8f884f487907a348921715b7cabf213f';
export const cDaiWhaleONE = '0x52185a2bbcfd67c1d07963e3575175ee9f95a551';
export const cDaiWhaleTWO = '0x67e9a5894d2713553cd3cbc7d034be9f1f830d3b';
export const cDaiWhaleTHREE = '0x7d6149ad9a573a6e2ca6ebf7d4897c1b766841b4';

// staking constants
export const stakingCooldownTicks = 5;
export const stakingUnstakeTicks = 150;
export const slashingDefaultPercentage = 3000;
export const slashingDefaultPercentageHR = 0.3;

export const CFG = {
  aDaiAddress: ADAI_ADDRESS,
  cDaiAddress: CDAI_ADDRESS,
  teamRewardInitialRate: '1',
  teamRewardBaselinePercentage: 0,
  stakingCooldownTicks,
  stakingUnstakeTicks,
};
