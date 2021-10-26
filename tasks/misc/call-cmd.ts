import { task, types } from 'hardhat/config';
import { exit } from 'process';
import { ZERO_ADDRESS } from '../../helpers/constants';
import { eNetwork } from '../../helpers/types';
import { ICallCommand } from '../helpers/call-cmd';
import { getDefaultMarketAddressController } from '../helpers/utils';

task('call-cmd', 'Invokes a configuration command')
  .addParam('ctl', 'Address of MarketAddressController', ZERO_ADDRESS, types.string)
  .addFlag('static', 'Make this call as static')
  .addFlag('waittx', 'Wait for tx to complete')
  .addOptionalParam('roles', 'Role(s) for the call', '', types.string)
  .addOptionalParam('gaslimit', 'Gas limit', undefined, types.int)
  .addOptionalParam('gasprice', 'Gas price', undefined, types.int)
  .addOptionalVariadicPositionalParam('args', 'Command arguments')
  .setAction(async ({ ctl, waittx, roles, static: staticCall, gaslimit: gasLimit, gasprice: gasPrice, args }, DRE) => {
    try {
      await DRE.run('set-DRE');

      const prep = await prepareArgs(<eNetwork>DRE.network.name, ctl, roles, args);

      await DRE.run('helper:call-cmd', {
        mode: staticCall ? 'static' : waittx ? 'waitTx' : 'call',
        ...prep,
        gaslimit: gasLimit,
        gasprice: gasPrice,
      });
    } catch (err) {
      console.error(err);
      exit(1);
    }
  });

task('encode-cmd', 'Encodes a configuration command')
  .addParam('ctl', 'Address of MarketAddressController', ZERO_ADDRESS, types.string)
  .addOptionalParam('roles', 'Role(s) for the call', '', types.string)
  .addOptionalVariadicPositionalParam('args', 'Command arguments')
  .setAction(async ({ ctl, roles, args }, DRE) => {
    try {
      await DRE.run('set-DRE');

      const prep = await prepareArgs(<eNetwork>DRE.network.name, ctl, roles, args);

      await DRE.run('helper:call-cmd', { mode: 'encode', ...prep });
    } catch (err) {
      console.error(err);
      exit(1);
    }
  });

const prepareArgs = async (
  network: eNetwork,
  ctl: string,
  roles: string,
  args: string[]
): Promise<{
  ctl: string;
  cmds: ICallCommand[];
}> => {
  ctl = await getDefaultMarketAddressController(network, ctl);
  const cmds: ICallCommand[] = [];
  const separator = '///';

  const roleList: string[] = roles === '' ? [] : roles[0] !== '[' ? [roles] : JSON.parse(roles);

  args.push(separator);
  let j = 0;
  for (let i = 0; i < args.length; i++) {
    if (args[i] != separator || i == j) {
      continue;
    }
    let cmd = args[j] || '';
    let roles = [...roleList];

    while (true) {
      const pos = cmd.indexOf('/');
      if (pos < 0) {
        break;
      }
      roles.push(cmd.substring(0, pos));
      cmd = cmd.substring(pos + 1);
    }

    cmds.push({
      roles,
      cmd,
      args: args.slice(j + 1, i),
    });
    j = i + 1;
  }

  console.log(cmds);

  return { ctl, cmds };
};
