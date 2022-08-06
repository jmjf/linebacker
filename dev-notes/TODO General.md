## (MAYBE) Add a trace id (uuid) to errors to make finding them in logs easier

I don't know if this really makes sense. I want to look at what Google, FB, MS, Amazon, etc., are doing and see if they have any patterns.

## Remove explicit any in code

I get eslint warnings about explicit `any`. The way to avoid them is `unknown` and cast the value where it's used, which forces me to specify a type so TypeScript can check it instead of telling TypeScript to not check.

I use explict `any` rarely and always in the external facing adapter code, so this warning probably isn't a major threat to code stability. But it should be a simple enough fix and fewer warnings is better in most cases.
