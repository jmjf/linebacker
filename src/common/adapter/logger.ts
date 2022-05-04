// for now, just alias console.log(); longer term, bunyan looks like a good choice
export const log = {
   fatal: console.log,
   error: console.log,
   warn: console.log,
   info: console.log,
   debug: console.log,
   trace: console.log
};