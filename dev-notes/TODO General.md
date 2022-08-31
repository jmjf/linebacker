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

## Can I make Express not return a JSON parse error on body failure
