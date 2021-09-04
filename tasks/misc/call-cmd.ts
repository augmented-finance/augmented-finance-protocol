import { task, types } from 'hardhat/config';
import { exit } from 'process';
import { ConfigNames } from '../../helpers/configuration';
import { ZERO_ADDRESS } from '../../helpers/constants';
import { falsyOrZeroAddress } from '../../helpers/misc-utils';

task('augmented:call-cmd', 'Invokes a configuration command')
  .addParam('ctl', 'Address of MarketAddressController', ZERO_ADDRESS, types.string)
  .addOptionalParam('cmd', 'Name of command', undefined, types.string)
  .addFlag('static', 'Make this call as static')
  .addFlag('compatible', 'Use backward compatible mode')
  .addOptionalParam('roles', 'Roles required', '', types.string)
  .addOptionalVariadicPositionalParam('args', 'Command arguments')
  .setAction(async ({ ctl, cmd, roles, static: staticCall, compatible, args }, DRE) => {
    const POOL_NAME = ConfigNames.Augmented;
    await DRE.run('set-DRE');

    if (falsyOrZeroAddress(ctl)) {
      ctl = '0xd07fff8a99f65bfee58938065c22580835a27249';
      // ctl = '0xcC8cD6549B3C1EE792038FDaf760479F1EcADC61';
      // ctl = await getMarketAddressController('0x3B0867022C53b3bFfeA650D76141f82046AdF541';
    }

    if (cmd === undefined && args.length > 0) {
      cmd = args[0];
      args = args.slice(1);
    }

    const roleList: string[] = roles === '' ? [] : roles[0] !== '[' ? [roles] : JSON.parse(roles);

    try {
      await DRE.run('helper:call-cmd', { ctl, cmd, roles: roleList, static: staticCall, compatible, args });
    } catch (err) {
      console.error(err);
      exit(1);
    }
  });
