import { task } from 'hardhat/config';
import { exit } from 'process';
import { getParamPerNetwork } from '../../helpers/contracts-helpers';
import { loadPoolConfig, ConfigNames, getWethAddress } from '../../helpers/configuration';
import {
  deployRewardTokenImpl,
  deployRewardBooster,
  deployRewardConfiguratorImpl,
  deployStakeConfiguratorImpl,
} from '../../helpers/contracts-deployments';
import { eNetwork, ICommonConfiguration } from '../../helpers/types';
import {
  getAgfToken,
  getMarketAddressController,
  getRewardConfiguratorProxy,
} from '../../helpers/contracts-getters';
import { waitForTx } from '../../helpers/misc-utils';
import { AccessFlags } from '../../helpers/access-flags';
import { MarketAccessController } from '../../types';

task(`full:deploy-reward-contracts`, `Deploys reward contracts for prod enviroment`)
  .addParam('pool', `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .addFlag('verify', `Verify contracts via Etherscan API.`)
  .setAction(async ({ verify, pool }, localBRE) => {
    await localBRE.run('set-DRE');
    const network = <eNetwork>localBRE.network.name;
    const poolConfig = loadPoolConfig(pool);
    const { Names } = poolConfig as ICommonConfiguration;

    const addressesProvider = await getMarketAddressController();

    await waitForTx(
      await addressesProvider.setRewardConfiguratorImpl(
        await deployedContractImpl(
          addressesProvider,
          'RewardConfiguratorV1',
          await deployRewardConfiguratorImpl(verify)
        )
      )
    );

    const configurator = await getRewardConfiguratorProxy(
      await addressesProvider.getRewardConfigurator()
    );

    const agfInitData = await configurator.buildRewardTokenInitData(
      Names.RewardTokenName,
      Names.RewardTokenSymbol,
      18
    );
    await waitForTx(
      await addressesProvider.setAddressAsProxyWithInit(
        AccessFlags.REWARD_TOKEN,
        await deployedContractImpl(
          addressesProvider,
          'AGFTokenV1',
          await deployRewardTokenImpl(verify)
        ),
        agfInitData
      )
    );

    const agf = await getAgfToken(await addressesProvider.getRewardToken());

    console.log(
      'AGF token: ',
      agf.address,
      await agf.name(),
      await agf.symbol(),
      await agf.decimals()
    );

    await waitForTx(
      await addressesProvider.setRewardController(
        await deployedContractImpl(
          addressesProvider,
          'RewardBooster',
          await deployRewardBooster([addressesProvider.address, agf.address], verify)
        )
      )
    );
  });

export const deployedContractImpl = async (
  ac: MarketAccessController,
  contractName: string,
  impl: any
) => {
  const implAddr: string = impl.address;
  console.log(`Deployed ${contractName}: `, implAddr);
  return implAddr;
};
