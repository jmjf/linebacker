## Better env management

-  I'd like something more like a JSON file or an object specification.

## Managing queue credential and URI data

See notes in 8.3 about `DefaultAzureCredential` "AzureQueue env considerations" and potential challenges with using environment variables or injecting into `process.env`.

## Choose a shutdown middleware for Express that hooks into the shutdown process

-  Early looking shows a few options listed on the Express site
-  lightship looks like it supports both Express and Fastify, so might be a good choice

## Add a configuration method to `AzureQueue`

-  Break dependency on environment variables
-  I need to investigate specific credential types so I can control the values

## Make event constructors take an id instead of an aggregate

-  Consider consequences and implications before doing this, but it should be okay in cases where we only need an id
-  Consider making id events store id as a string

## In subscribers, use Map to manage failed services instead of object/Dictionary type

-  `failedServices = new Map()`
-  `failedServices.size > 0`
-  `for (serviceName of failedServices.keys())`
-  `failedServices.has(serviceName)`
