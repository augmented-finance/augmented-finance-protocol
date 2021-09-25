import { task, types } from 'hardhat/config';
import { ZERO_ADDRESS } from '../../helpers/constants';
import { eNetwork } from '../../helpers/types';
import { getDefaultMarketAddressController } from '../helpers/utils';

task('augmented:calc-apy', 'Calculates current APYs')
  .addParam('ctl', 'Address of MarketAddressController', ZERO_ADDRESS, types.string)
  .addParam('user', 'User address to calc APY', ZERO_ADDRESS, types.string)
  .setAction(async ({ ctl, user: userAddr }, DRE) => {
    await DRE.run('set-DRE');

    ctl = getDefaultMarketAddressController(<eNetwork>DRE.network.name, ctl);
    await DRE.run('helper:calc-apy', { ctl, user: userAddr });
  });
