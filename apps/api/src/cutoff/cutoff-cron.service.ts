import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CutoffService } from './cutoff.service';

/**
 * ARCHITECTURE §15: "Cut-off evaluation | every 5 min." Registered only in
 * `WorkerModule` — never `AppModule` — since "the scheduler running in more
 * than one process double-fires every alert. One process only." `CutoffService`
 * itself is shared (`CutoffModule`); only this cron trigger is worker-exclusive.
 */
@Injectable()
export class CutoffCronService {
  constructor(private readonly cutoffService: CutoffService) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async evaluate(): Promise<void> {
    await this.cutoffService.evaluateAll();
  }
}
