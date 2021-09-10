import { task, types } from 'hardhat/config';
import { exit } from 'process';
import { ConfigNames, loadPoolConfig } from '../../helpers/configuration';
import { ZERO_ADDRESS } from '../../helpers/constants';
import { getMarketAddressController, hasMarketAddressController } from '../../helpers/contracts-getters';
import { getParamPerNetwork } from '../../helpers/contracts-helpers';
import { falsyOrZeroAddress } from '../../helpers/misc-utils';
import { eNetwork, ICommonConfiguration } from '../../helpers/types';

task('augmented:call-cmd', 'Invokes a configuration command')
  .addParam('ctl', 'Address of MarketAddressController', ZERO_ADDRESS, types.string)
  .addOptionalParam('cmd', 'Name of command', undefined, types.string)
  .addFlag('static', 'Make this call as static')
  .addFlag('compatible', 'Use backward compatible mode')
  .addOptionalParam('roles', 'Roles required', '', types.string)
  .addOptionalParam('gasLimit', 'Gas limit', undefined, types.int)
  .addOptionalVariadicPositionalParam('args', 'Command arguments')
  .setAction(async ({ ctl, cmd, roles, static: staticCall, compatible, gasLimit, args }, DRE) => {
    const POOL_NAME = ConfigNames.Augmented;
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

    if (cmd === undefined && args.length > 0) {
      cmd = args[0];
      args = args.slice(1);
    }

    const roleList: string[] = roles === '' ? [] : roles[0] !== '[' ? [roles] : JSON.parse(roles);

    try {
      await DRE.run('helper:call-cmd', { ctl, cmd, roles: roleList, static: staticCall, compatible, gasLimit, args });
    } catch (err) {
      console.error(err);
      exit(1);
    }
  });
