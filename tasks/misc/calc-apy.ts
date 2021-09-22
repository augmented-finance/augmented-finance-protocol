import { task, types } from 'hardhat/config';
import { ConfigNames, loadPoolConfig } from '../../helpers/configuration';
import { ZERO_ADDRESS } from '../../helpers/constants';
import { getMarketAddressController, hasMarketAddressController } from '../../helpers/contracts-getters';
import { getParamPerNetwork } from '../../helpers/contracts-helpers';
import { falsyOrZeroAddress, getFirstSigner } from '../../helpers/misc-utils';
import { eNetwork, ICommonConfiguration } from '../../helpers/types';

task('augmented:calc-apy', 'Calculates current APYs')
  .addParam('ctl', 'Address of MarketAddressController', ZERO_ADDRESS, types.string)
  .addParam('user', 'User address to calc APY', ZERO_ADDRESS, types.string)
  .setAction(async ({ ctl, user: userAddr }, DRE) => {
    await DRE.run('set-DRE');

    if (falsyOrZeroAddress(ctl)) {
      if (hasMarketAddressController()) {
        ctl = (await getMarketAddressController()).address;
      } else {
        const network = <eNetwork>DRE.network.name;
        const POOL_NAME = ConfigNames.Augmented;
        const poolConfig = loadPoolConfig(POOL_NAME);
        const { AddressProvider } = poolConfig as ICommonConfiguration;
        ctl = getParamPerNetwork(AddressProvider, network);
      }
    }

    await DRE.run('helper:calc-apy', { ctl, user: userAddr });
  });
