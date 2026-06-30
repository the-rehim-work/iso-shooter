import { integrate, type InputCommand, type MoveState } from './movement.js';

type StepFn = (state: MoveState, cmd: InputCommand) => MoveState;

export class PredictedEntity {
  state: MoveState;
  private pending: InputCommand[] = [];
  private stepFn: StepFn;

  constructor(initial: MoveState, stepFn?: StepFn) {
    this.state = { ...initial };
    this.stepFn = stepFn ?? integrate;
  }

  predict(cmd: InputCommand): void {
    this.pending.push(cmd);
    this.state = this.stepFn(this.state, cmd);
  }

  reconcile(authoritative: MoveState, ackSeq: number): void {
    this.pending = this.pending.filter((c) => c.seq > ackSeq);
    let s: MoveState = { ...authoritative };
    for (const c of this.pending) {
      s = this.stepFn(s, c);
    }
    this.state = s;
  }

  pendingCount(): number {
    return this.pending.length;
  }
}
