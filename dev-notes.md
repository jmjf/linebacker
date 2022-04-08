# Experiments with Express and TypeScript

## Setup

```s
# create the directory
mkdir express-ts-api
cd express-ts-api

# establish a git repo
git init

# create package.json
npm init

# commit changes
git add *
git commit -m "initialize"
```

When running `npm init` Set test command to `jest` and license to MIT.

Node installs packages in a directory called node_modules. We can recreate node modules from `package.json` by running `npm install`, so we want to exclude it from the git repo.

I also like to keep environment settings in an `env` directory and `.gitignore` it. Keeping all environment files in a specific folder helps avoid leaking credentials if I forget to include a specific environment file. I'll maintain a SAMPLE.env file in the project root to guide anyone using the code.

Create `.gitignore`. Add the following to the file to exclude node_modules and the env directory from the repo.

```
node_modules
env
```

```s
# create env
mkdir env

# npm i = install runtime dependencies 
npm i express dotenv 

# npm i -D = install development dependencies
npm i -D typescript @types/express @types/node

# initialize tsconfig.json
npx tsc --init
```

Edit `tsconfig.json` to look like:

```json
{
  "compilerOptions": {
    /* Visit https://aka.ms/tsconfig.json to read more about this file */

    /* Projects */

    /* Language and Environment */
      // this is an api backend, using node 16 -> ES2021 support
    "target": "ES2021",                                  /* Set the JavaScript language version for emitted JavaScript and include compatible library declarations. */
    "lib": ["ES2021"],                                   /* Specify a set of bundled library declaration files that describe the target runtime environment. */

    /* Modules */
    "module": "commonjs",                                /* Specify what module code is generated. */

    /* Emit */
    "outDir": "./dist",                                  /* Specify an output folder for all emitted files. */
    
    /* Interop Constraints */
    "allowSyntheticDefaultImports": true,                /* Allow 'import x from y' when a module doesn't have a default export. */
    "esModuleInterop": true,                             /* Emit additional JavaScript to ease support for importing CommonJS modules. This enables `allowSyntheticDefaultImports` for type compatibility. */
    "forceConsistentCasingInFileNames": true,            /* Ensure that casing is correct in imports. */

    /* Type Checking */
    "strict": true,                                      /* Enable all strict type-checking options. */
    "noImplicitAny": true,                               /* Enable error reporting for expressions and declarations with an implied `any` type.. */
    "noImplicitReturns": true,                           /* Enable error reporting for codepaths that do not explicitly return in a function. */
    "noFallthroughCasesInSwitch": true,                  /* Enable error reporting for fallthrough cases in switch statements. */
    "allowUnreachableCode": false,                       /* Disable error reporting for unreachable code. */

    /* Completeness */
    "skipLibCheck": true                                 /* Skip type checking all .d.ts files. */
  }
}
```

```s
git add *
git commit -m "install and configure dependencies"
```