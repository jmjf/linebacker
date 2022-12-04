import { DelayedEventRunner } from '../../../infrastructure/resilience/DelayedEventRunner';

import { err, Ok, ok, Result } from '../../../common/core/Result';
import { UseCase } from '../../../common/application/UseCase';
import * as AdapterErrors from '../../../common/adapter/AdapterErrors';
import { EventBusEvent } from '../../../common/infrastructure/event-bus/IEventBus';

import { RestartStalledRequestsDTO } from './RestartStalledRequestsDTO';
import { BackupRequestAllowed } from '../../domain/BackupRequestAllowed.event';
import { BackupRequestStatusTypeValues } from '../../domain/BackupRequestStatusType';
import { BackupRequest } from '../../domain/BackupRequest';
import { IBackupRequestRepo } from '../../adapter/IBackupRequestRepo';
import { ApplicationResilienceReadyEventData } from '../../../infrastructure/resilience/ApplicationResilienceReady.event';
import { BackupRequestReceived } from '../../domain/BackupRequestReceived.event';


const moduleName = module.filename.slice(module.filename.lastIndexOf('/') + 1);

type StatusResult = Result<EventBusEvent<unknown>[], AdapterErrors.DatabaseError>;

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

		let allowedEvents: BackupRequestAllowed[] = [];
		let receivedEvents: BackupRequestReceived[] = [];

		const allowedQueryResult = await this.backupRequestRepo.getByStatusBeforeTimestamp(
			BackupRequestStatusTypeValues.Allowed,
			dto.beforeTimestamp
		);
		if (allowedQueryResult.isOk()) {
			// the event wants a "BackupRequest", but only needs the id as a UniqueIdentifier
			allowedEvents = allowedQueryResult.value
				.filter((result) => result.isOk())
				// TypeScript doesn't realize that everything is ok, so cast it
				.map((okResult) => new BackupRequestAllowed((okResult as Ok<BackupRequest, never>).value));
		}
		// console.log('RSRUC allowedEvents', allowedEvents);

		const receivedQueryResult = await this.backupRequestRepo.getByStatusBeforeTimestamp(
			BackupRequestStatusTypeValues.Received,
			dto.beforeTimestamp
		);
		if (receivedQueryResult.isOk()) {
			// console.log('RSRUC receivedQueryResult', receivedQueryResult);
			receivedEvents = receivedQueryResult.value
			.filter((result) => result.isOk())
			// TypeScript doesn't realize that everything is ok, so cast it
			.map((okResult) => new BackupRequestReceived((okResult as Ok<BackupRequest, never>).value));
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
