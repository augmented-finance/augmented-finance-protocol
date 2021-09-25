import { task } from 'hardhat/config';
import { ConfigurableTaskDefinition, TaskArguments } from 'hardhat/types';
import path from 'path';
import { ConfigNames } from '../../helpers/configuration';

export interface IDeployStepParams {
  pool: string;
  verify: boolean;
}

export interface IDeployStep {
  seqId: number;
  stepName: string;
  taskName: string;
  args: TaskArguments;
}

const stepCatalog = new Map<
  string,
  {
    stepName: string;
    taskName: string;
    paramsFn: (params: IDeployStepParams) => Promise<TaskArguments>;
  }[]
>();

stepCatalog.set('full', []);

const defaultParams = async (params: IDeployStepParams) => ({ pool: params.pool, verify: params.verify });

export function deployTask(
  name: string,
  description: string,
  moduleDir: string,
  paramsFn?: (params: IDeployStepParams) => Promise<TaskArguments>
): ConfigurableTaskDefinition {
  const deployType = name.substring(0, name.indexOf(':'));
  if (path.basename(moduleDir) != deployType) {
    throw new Error(`Invalid location: ${deployType}, ${moduleDir}`);
  }

  addStep(deployType, description, name, paramsFn);
  return task(name, description)
    .addParam('pool', `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
    .addFlag('verify', `Verify contracts via Etherscan API.`);
}

const addStep = (
  deployType: string,
  stepName: string,
  taskName: string,
  paramsFn?: (params: IDeployStepParams) => Promise<TaskArguments>
) => {
  let steps = stepCatalog.get(deployType);
  if (steps === undefined) {
    throw new Error('Unknown deploy type: ' + deployType);
    // steps = [];
    // stepCatalog.set(deployType, steps);
  }

  console.log(deployType, stepName, taskName, steps.length + 1);
  steps.push({ stepName, taskName, paramsFn: paramsFn || defaultParams });
};

export const getDeploySteps = async (deployType: string, params: IDeployStepParams) => {
  const stepList = stepCatalog.get(deployType);
  if (stepList === undefined) {
    throw new Error('Unknown deploy type: ' + deployType);
  }

  const steps: IDeployStep[] = [];

  for (let i = 0; i < stepList.length; i++) {
    steps.push({
      seqId: i + 1,
      stepName: stepList[i].stepName,
      taskName: stepList[i].taskName,
      args: await stepList[i].paramsFn(params),
    });
  }

  return steps;
};
