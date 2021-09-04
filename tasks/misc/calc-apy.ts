import { task, types } from 'hardhat/config';
import { ConfigNames } from '../../helpers/configuration';
import { ZERO_ADDRESS } from '../../helpers/constants';
import { cleanupJsonDb, falsyOrZeroAddress, getFirstSigner } from '../../helpers/misc-utils';

task('augmented:calc-apy', 'Calculates current APYs')
  .addParam('ctl', 'Address of MarketAddressController', ZERO_ADDRESS, types.string)
  .addParam('user', 'User address to calc APY', ZERO_ADDRESS, types.string)
  .setAction(async ({ ctl, userAddr }, DRE) => {
    const POOL_NAME = ConfigNames.Augmented;
    await DRE.run('set-DRE');

    if (falsyOrZeroAddress(ctl)) {
      ctl = '0xd07fff8a99f65bfee58938065c22580835a27249';
      // ctl = '0xcC8cD6549B3C1EE792038FDaf760479F1EcADC61';
      // ctl = await getMarketAddressController('0x3B0867022C53b3bFfeA650D76141f82046AdF541';
    }

    if (falsyOrZeroAddress(userAddr)) {
      userAddr = (await getFirstSigner()).address;
    }

    await DRE.run('helper:calc-apy', { ctl, userAddr });
  });
