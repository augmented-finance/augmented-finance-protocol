import { task } from 'hardhat/config';

import { eContractid } from '../../helpers/types';
import { deployUiPoolDataProvider } from '../../helpers/contracts-deployments';
import {
  getLendingPoolAddressesProvider,
  getUiPoolDataProvider,
} from '../../helpers/contracts-getters';

task(`userdata`, `Deploys the UiPoolDataProvider contract`)
  .addFlag('user', 'User address')
  .setAction(async ({ user }, localBRE) => {
    await localBRE.run('set-DRE');

    if (!localBRE.network.config.chainId) {
      throw new Error('INVALID_CHAIN_ID');
    }

    const dataProvider = await getUiPoolDataProvider();

    console.log('Fetching user data...');

    //0x6c9862f860cdc557f7e8268ecb4a9c4f9004022f
    const data = await dataProvider.getReservesData(
      '0x88757f2f99175387aB4C6a4b3067c77A695b0349',
      '0x31B29E1d3524f281f513B34F3855Ee8E473c0264'
    );
    console.log(data);
  });
