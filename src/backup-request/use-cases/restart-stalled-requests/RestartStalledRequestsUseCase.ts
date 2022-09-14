import { err, ok, Result } from '../../../common/core/Result';
import { UseCase } from '../../../common/application/UseCase';
import * as AdapterErrors from '../../../common/adapter/AdapterErrors';

import { IBackupRequestRepo } from '../../adapter/IBackupRequestRepo';

import { RestartStalledRequestsDTO } from './RestartStalledRequestsDTO';
import { IDomainEvent } from '../../../common/domain/DomainEventBus';
import { RequestStatusTypeValues } from '../../domain/RequestStatusType';
import { BackupRequestAllowed } from '../../domain/BackupRequestAllowed';
import { UniqueIdentifier } from '../../../common/domain/UniqueIdentifier';
import { BackupRequest } from '../../domain/BackupRequest';
import { BackupRequestCreated } from '../../domain/BackupRequestCreated';
import { DelayedEventRunner } from '../../../infrastructure/resilience/DelayedEventRunner';

const moduleName = module.filename.slice(module.filename.lastIndexOf('/') + 1);

type StatusResult = Result<IDomainEvent[], AdapterErrors.DatabaseError>;

type Response = {
	allowedResult: StatusResult;
	receivedResult: StatusResult;
};

export class RestartStalledRequestsUseCase implements UseCase<RestartStalledRequestsDTO, Promise<Response>> {
	private backupRequestRepo: IBackupRequestRepo;
	private delayedEventRunner: DelayedEventRunner;

	constructor(backupRequestRepo: IBackupRequestRepo, abortSignal: AbortSignal, eventDelay?: 250) {
		this.backupRequestRepo = backupRequestRepo;
		this.delayedEventRunner = new DelayedEventRunner(abortSignal, eventDelay);
	}

	public async execute(dto: RestartStalledRequestsDTO): Promise<Response> {
		const functionName = 'execute';

		let allowedEvents: IDomainEvent[] = [];
		let receivedEvents: IDomainEvent[] = [];

		const allowedQueryResult = await this.backupRequestRepo.getRequestIdsByStatusBeforeTimestamp(
			RequestStatusTypeValues.Allowed,
			dto.beforeTimestamp
		);
		if (allowedQueryResult.isOk()) {
			// the event wants a "BackupRequest", but only needs the id as a UniqueIdentifier
			allowedEvents = allowedQueryResult.value.map((id) => new BackupRequestAllowed(new UniqueIdentifier(id)));
		}
		// console.log('RSRUC allowedEvents', allowedEvents);

		const receivedQueryResult = await this.backupRequestRepo.getRequestIdsByStatusBeforeTimestamp(
			RequestStatusTypeValues.Received,
			dto.beforeTimestamp
		);
		if (receivedQueryResult.isOk()) {
			// console.log('RSRUC receivedQueryResult', receivedQueryResult);
			receivedEvents = receivedQueryResult.value.map((id) => new BackupRequestCreated(new UniqueIdentifier(id)));
		}
		// console.log('RSRUC receivedEvents', receivedEvents);

		for (const ev of allowedEvents) {
			// console.log('RSRUC add allowed', ev);
			this.delayedEventRunner.addEvent(ev);
		}

		for (const ev of receivedEvents) {
			// console.log('RSRUC add received', ev);
			this.delayedEventRunner.addEvent(ev);
		}

		this.delayedEventRunner.runEvents();

		const allowedResult =
			allowedQueryResult.isErr() && allowedQueryResult.error.name === 'DatabaseError'
				? err(allowedQueryResult.error as AdapterErrors.DatabaseError)
				: ok(allowedEvents);
		const receivedResult =
			receivedQueryResult.isErr() && receivedQueryResult.error.name === 'DatabaseError'
				? err(receivedQueryResult.error as AdapterErrors.DatabaseError)
				: ok(receivedEvents);

		// console.log('RSRUC results', allowedResult, receivedResult, this.delayedEventRunner.events);
		return { allowedResult, receivedResult };
	}
}
