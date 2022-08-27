## (MAYBE) Add a trace id (uuid) to errors to make finding them in logs easier

I don't know if this really makes sense. I want to look at what Google, FB, MS, Amazon, etc., are doing and see if they have any patterns.

## Remove explicit any in code

I get eslint warnings about explicit `any`. The way to avoid them is `unknown` and cast the value where it's used, which forces me to specify a type so TypeScript can check it instead of telling TypeScript to not check.

I use explict `any` rarely and always in the external facing adapter code, so this warning probably isn't a major threat to code stability. But it should be a simple enough fix and fewer warnings is better in most cases.

## Ensure log outputs are consistent

-  In some places I use message, in others msg
-  Some places not an object string maybe
-  requestId -> backupRequestId to avoid future confusion
-  Consider adding some kind of context for the log to make the code findable

## Better env management

-  I'd like something more like a JSON file or an object specification.

## Managing queue credential and URI data

See notes in 8.3 about `DefaultAzureCredential` "AzureQueue env considerations" and potential challenges with using environment variables or injecting into `process.env`.

## Add Prisma prefix on Prisma entities

Avoid confusion with my entities/aggregates with the same name.

Also, make mapping functions explicit to avoid possible issues with data types.

## ReceiveStoreStatusReplyUseCase

Need to revisit the logic

-  If the backup exists, do not save it again
-  If the backup request is already succeeded or failed, do not save again
-  Adjust tests

## Replace morgan with pino in Express

Because why have two loggers?

## Can I make Express not return a JSON parse error

## If CreateBackupRequest gets no backupJobId, it generates one

Because it calls `new UniqueIdentifier(dto.backupJobId)`, which will always return an id.

Stemmler makes them `Entity` types. I'm not sure that would handle my case and I don't want to do it. Options:

-  Let the use case check and return (Should it know the backup id is required?)
   -  Some use cases are retrieving data from the repo and ensuring they get a result, but that's more an orchestration concern.
   -  Some use cases check that a status is as expected, but that's a business process concern (this step of the process requires this status); the data is valid, but may not be valid for the use case
-  Passing a string to `BackupRequest.create()` (it will check)
   -  This feels more correct because `BackupRequest` is responsible for knowing it needs a value for `backupJobId`

To do

-  Add a test for this case (in the use case test? in the controller test?)
-  Code to make it pass
