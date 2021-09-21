import { task, types } from 'hardhat/config';
import { exit } from 'process';
import { ConfigNames, loadPoolConfig } from '../../helpers/configuration';
import { ZERO_ADDRESS } from '../../helpers/constants';
import { getMarketAddressController, hasMarketAddressController } from '../../helpers/contracts-getters';
import { getParamPerNetwork } from '../../helpers/contracts-helpers';
import { falsyOrZeroAddress } from '../../helpers/misc-utils';
import { eNetwork, ICommonConfiguration, tEthereumAddress } from '../../helpers/types';

task('augmented:call-cmd', 'Invokes a configuration command')
  .addParam('ctl', 'Address of MarketAddressController', ZERO_ADDRESS, types.string)
  .addOptionalParam('cmd', 'Name of command', undefined, types.string)
  .addFlag('static', 'Make this call as static')
  .addFlag('compatible', 'Use backward compatible mode')
  .addOptionalParam('roles', 'Roles required', '', types.string)
  .addOptionalParam('gasLimit', 'Gas limit', undefined, types.int)
  .addOptionalVariadicPositionalParam('args', 'Command arguments')
  .setAction(async ({ ctl, cmd, roles, static: staticCall, compatible, gasLimit, args }, DRE) => {
    try {
      await DRE.run('set-DRE');

      const prep = await prepareArgs(<eNetwork>DRE.network.name, ctl, cmd, roles, args);

      await DRE.run('helper:call-cmd', { ...prep, static: staticCall, compatible, gasLimit });
    } catch (err) {
      console.error(err);
      exit(1);
    }
  });

task('augmented:encode-cmd', 'Encodes a configuration command')
  .addParam('ctl', 'Address of MarketAddressController', ZERO_ADDRESS, types.string)
  .addOptionalParam('cmd', 'Name of command', undefined, types.string)
  .addOptionalParam('roles', 'Roles required', '', types.string)
  .addOptionalVariadicPositionalParam('args', 'Command arguments')
  .setAction(async ({ ctl, cmd, roles, args }, DRE) => {
    try {
      await DRE.run('set-DRE');

      const prep = await prepareArgs(<eNetwork>DRE.network.name, ctl, cmd, roles, args);

      await DRE.run('helper:call-cmd', { ...prep, encode: true });
    } catch (err) {
      console.error(err);
      exit(1);
    }
  });

const getDefaultAccessControllerAddr = async (network: eNetwork) => {
  if (hasMarketAddressController()) {
    return (await getMarketAddressController()).address;
  }

  const POOL_NAME = ConfigNames.Augmented;
  const poolConfig = loadPoolConfig(POOL_NAME);
  const { AddressProvider } = poolConfig as ICommonConfiguration;
  return getParamPerNetwork(AddressProvider, network);
};

const prepareArgs = async (
  network: eNetwork,
  ctl: string,
  cmd: string,
  roles: string,
  args: any[]
): Promise<{
  ctl: string;
  cmd: string;
  roles: string[];
  args: any[];
}> => {
  if (falsyOrZeroAddress(ctl)) {
    ctl = await getDefaultAccessControllerAddr(network);
  }

  if (cmd === undefined && args.length > 0) {
    cmd = args[0];
    args = args.slice(1);
  }

  const roleList: string[] = roles === '' ? [] : roles[0] !== '[' ? [roles] : JSON.parse(roles);

  return { ctl, cmd, roles: roleList, args };
};
