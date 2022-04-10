import { UseCase } from '../../common/application/UseCase';
import { Result } from '../../common/domain/Result';
import { Either, left, right } from '../../common/domain/Either';
import { CreateRequestDTO } from './CreateRequestDTO';
import { IBackupRequestRepo } from '../adapter/BackupRequestRepo';

// add errors when you define them
type Response = Either<Result<any>, Result<void>>;

export class CreateRequestUseCase
	implements UseCase<CreateRequestDTO, Promise<Response>>
{
	private backupRequestRepo: IBackupRequestRepo;

	constructor(backupRequestRepo: IBackupRequestRepo) {
		this.backupRequestRepo = backupRequestRepo;
	}

	async execute(request: CreateRequestDTO): Promise<Response> {
		return right(Result.ok<any>('ok'));
	}
}
