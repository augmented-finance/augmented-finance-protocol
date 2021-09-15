import { TaskArguments } from 'hardhat/types';

export interface IStepParams {
  pool: string;
  verify: boolean;
}

export interface IStep {
  seqId: number;
  stepName: string;
  taskName: string;
  args: TaskArguments;
}

const fullSteps: {
  ordinal: number;
  stepName: string;
  taskName: string;
  paramsFn: (params: IStepParams) => Promise<TaskArguments>;
}[] = [];

const defaultParams = async (params: IStepParams) => ({ pool: params.pool, verify: params.verify });

export const addFullStep = (
  ordinal: number,
  stepName: string,
  taskName: string,
  paramsFn?: (params: IStepParams) => Promise<TaskArguments>
) => {
  fullSteps.push({ ordinal, stepName, taskName, paramsFn: paramsFn || defaultParams });
};

export const getFullSteps = async (params: IStepParams) => {
  const sorted = fullSteps.sort((v0, v1) => {
    if (v0.ordinal != v1.ordinal) {
      return v0.ordinal - v1.ordinal;
    }
    if (v0.stepName != v1.stepName) {
      return v0.stepName > v1.stepName ? 1 : -1;
    }
    return 0;
  });
  const steps: IStep[] = [];

  for (let i = 0; i < sorted.length; i++) {
    steps.push({
      seqId: i + 1,
      stepName: sorted[i].stepName,
      taskName: sorted[i].taskName,
      args: await sorted[i].paramsFn(params),
    });
  }

  return steps;
};
