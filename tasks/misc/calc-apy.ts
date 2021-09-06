import { task, types } from 'hardhat/config';
import { ConfigNames } from '../../helpers/configuration';
import { ZERO_ADDRESS } from '../../helpers/constants';
import { falsyOrZeroAddress, getFirstSigner } from '../../helpers/misc-utils';

task('augmented:calc-apy', 'Calculates current APYs')
  .addParam('ctl', 'Address of MarketAddressController', ZERO_ADDRESS, types.string)
  .addParam('user', 'User address to calc APY', ZERO_ADDRESS, types.string)
  .setAction(async ({ ctl, userAddr }, DRE) => {
    const POOL_NAME = ConfigNames.Augmented;
    await DRE.run('set-DRE');

    if (falsyOrZeroAddress(userAddr)) {
      userAddr = (await getFirstSigner()).address;
    }

    await DRE.run('helper:calc-apy', { ctl, userAddr });
  });
