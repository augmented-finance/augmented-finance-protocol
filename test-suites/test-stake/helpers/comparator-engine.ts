import { BigNumber, Event } from 'ethers';

const { expect } = require('chai');

interface CustomFieldLogic<Update, State> {
  fieldName: keyof State;
  logic: (
    stateUpdate: Update,
    stateBefore: State,
    stateAfter: State,
    txTimestamp: number
  ) => Promise<string | BigNumber> | string | BigNumber;
}

export interface CompareRules<Update, State> {
  fieldsEqualToInput?: (keyof State)[];
  fieldsEqualToAnother?: { fieldName: keyof State; equalTo: keyof Update }[];
  fieldsWithCustomLogic?: CustomFieldLogic<Update, State>[];
}

export async function comparatorEngine<Input extends object, State extends object>(
  fieldsToTrack: (keyof State)[],
  updateInput: Input,
  stateBefore: State,
  stateAfter: State,
  actionBlockTimestamp: number,
  {
    fieldsEqualToInput = [],
    fieldsEqualToAnother = [],
    fieldsWithCustomLogic = [],
  }: CompareRules<Input, State>
) {
  const unchangedFields = fieldsToTrack.filter(
    (fieldName) =>
      !fieldsEqualToInput.includes(fieldName) &&
      !fieldsEqualToAnother.find((eq) => eq.fieldName === fieldName) &&
      !fieldsWithCustomLogic.find((eq) => eq.fieldName === fieldName)
  );

  for (const fieldName of unchangedFields) {
    // @ts-ignore
    expect(stateAfter[fieldName].toString()).to.be.equal(
      // @ts-ignore
      stateBefore[fieldName].toString(),
      `${fieldName} should not change`
    );
  }

  for (const fieldName of fieldsEqualToInput) {
    // @ts-ignore
    expect(stateAfter[fieldName].toString()).to.be.equal(
      // @ts-ignore
      updateInput[fieldName].toString(),
      `${fieldName} are not updated`
    );
  }

  for (const { fieldName, equalTo } of fieldsEqualToAnother) {
    // @ts-ignore
    expect(stateAfter[fieldName].toString()).to.be.equal(
      // @ts-ignore
      updateInput[equalTo].toString(),
      `${fieldName} are not updated`
    );
  }

  for (const { fieldName, logic } of fieldsWithCustomLogic) {
    const logicOutput = logic(updateInput, stateBefore, stateAfter, actionBlockTimestamp);
    const equalTo = logicOutput instanceof Promise ? await logicOutput : logicOutput;
    // @ts-ignore
    expect(stateAfter[fieldName].toString()).to.be.equal(
      equalTo.toString(),
      `${fieldName} are not correctly updated`
    );
  }
}

export function eventChecker(event: Event, name: string, args: any[] = []): void {
  expect(event.event).to.be.equal(name, `Incorrect event emitted`);
  expect(event.args?.length || 0 / 2).to.be.equal(args.length, `${name} signature are wrong`);
  args.forEach((arg, index) => {
    expect(event.args && event.args[index].toString()).to.be.equal(
      arg.toString(),
      `${name} has incorrect value on position ${index}`
    );
  });
}
