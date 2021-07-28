import { task } from 'hardhat/config';
import { loadPoolConfig, ConfigNames } from '../../helpers/configuration';
import {
  deployAGFTokenV1Impl,
  deployRewardBooster,
  deployRewardConfiguratorImpl,
  deployXAGFTokenV1Impl,
} from '../../helpers/contracts-deployments';
import { eNetwork, ICommonConfiguration } from '../../helpers/types';
import {
  getAGFTokenV1Impl,
  getMarketAddressController,
  getRewardConfiguratorProxy,
  getRewardBooster,
} from '../../helpers/contracts-getters';
import { getFirstSigner, waitForTx } from '../../helpers/misc-utils';
import { AccessFlags } from '../../helpers/access-flags';
import { MarketAccessController } from '../../types';

task(
  `full:deploy-reward-contracts`,
  `Deploys reward contracts, AGF and xAGF tokens for prod enviroment`
)
  .addParam('pool', `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .addFlag('verify', `Verify contracts via Etherscan API.`)
  .setAction(async ({ verify, pool }, localBRE) => {
    await localBRE.run('set-DRE');
    const network = <eNetwork>localBRE.network.name;
    const poolConfig = loadPoolConfig(pool);
    const { Names } = poolConfig as ICommonConfiguration;

    const addressesProvider = await getMarketAddressController();

    await waitForTx(
      await addressesProvider.grantRoles(
        (await getFirstSigner()).address,
        AccessFlags.REWARD_CONFIG_ADMIN
      )
    );

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

    await addressesProvider.setAddressAsProxyWithInit(
      AccessFlags.REWARD_TOKEN,
      await deployedContractImpl(
        addressesProvider,
        'AGFTokenV1',
        await deployAGFTokenV1Impl(verify)
      ),
      agfInitData
    );

    const agf = await getAGFTokenV1Impl(await addressesProvider.getRewardToken());

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

    const booster = await getRewardBooster(await addressesProvider.getRewardController());

    const xagfInitData = await configurator.buildRewardTokenInitData(
      Names.RewardStakeTokenName,
      Names.RewardStakeTokenSymbol,
      18
    );

    await addressesProvider.setAddressAsProxyWithInit(
      AccessFlags.REWARD_STAKE_TOKEN,
      await deployedContractImpl(
        addressesProvider,
        'XAGFTokenV1',
        await deployXAGFTokenV1Impl(verify)
      ),
      xagfInitData
    );

    const xagf = await getAGFTokenV1Impl(await addressesProvider.getRewardStakeToken());
    await waitForTx(
      await configurator.configureRewardBoost(xagf.address, true, xagf.address, false)
    );

    console.log(
      'xAGF token: ',
      xagf.address,
      await xagf.name(),
      await xagf.symbol(),
      await xagf.decimals()
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
