import { RAY } from '../../helpers/constants';

// mainnet adresses
export const ADAI_ADDRESS = '0x028171bca77440897b824ca71d1c56cac55b68a3';
export const CDAI_ADDRESS = '0x5d3a536e4d6dbd6114cc1ead35777bab948e3643';
export const DAI_ADDRESS = '0x6b175474e89094c44da98b954eedeac495271d0f';
export const LP_ADDRESS = '0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9';

export const CFG = {
  aDaiAddress: ADAI_ADDRESS,
  cDaiAdress: CDAI_ADDRESS,
  withZombieAdapter: false,
  withAAVEAdapter: true,
  teamRewardInitialRate: RAY,
  teamRewardBaselinePercentage: 0,
  teamRewardUnlockBlock: 1000,
  teamRewardsFreezePercentage: 0,
  zombieRewardLimit: 5000,
};
