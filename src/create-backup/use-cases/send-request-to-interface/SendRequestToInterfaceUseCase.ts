import { UseCase } from '../../../common/application/UseCase';
import { Either, left, right } from '../../../common/domain/Either';
import { Result } from '../../../common/domain/Result';
import { IBackupRequestRepo } from '../../adapter/BackupRequestRepo';
import { SendRequestToInterfaceDTO } from './SendRequestToInterfaceDTO';

type Response = Either<Result<any>, Result<void>>;

export class SendRequestToInterfaceUseCase implements UseCase<SendRequestToInterfaceDTO, Promise<Response>> {

   private backupRequestRepo: IBackupRequestRepo;

   constructor (backupRequestRepo: IBackupRequestRepo) {
     this.backupRequestRepo = backupRequestRepo;
   }

   public async execute(request: SendRequestToInterfaceDTO): Promise<Response> {
      return right(Result.succeed());
   }
}