class CustomError1 extends Error {
   constructor(message, cause) {
      super(message);
      this.cause = cause;
   }
}

class CustomError2 extends Error {
   constructor(message, cause) {
      super(message);
      this.cause = cause;
      this.name = this.constructor.name;
   }
}

class CustomError3 extends CustomError2 {
   constructor(message, cause) {
      super(message, cause);
   }
}

class CustomError4 extends CustomError2 {
   constructor(message, cause) {
      super('', cause);
      this.message = (typeof message === 'object')
         ? JSON.stringify(message)
         : message;
      this.caller = Object.values(this);
   }
}

class CustomError5 extends Error{
   constructor(message) {
      super(message);
      this.name = this.constructor.name;
      const firstChar = this.stack.indexOf('at ') + 3;
      const lastChar = this.stack.indexOf('\n', firstChar);
      this.caller = this.stack.slice(firstChar, lastChar);
      console.log('!!', this.stack.split('\n')[1].match(/at ([^ ]+)/)?.[1]);
   }
}

class CustomError5b extends CustomError5 {};

function logError(e) {
   console.log('error', e);
   console.log('toString()', e.toString());
   console.log('name', e.name);
   console.log('message', e.message);
   console.log('code', e.code);
   console.log('stack', typeof e.stack, e.stack);
   console.log('caller', e.caller);
   console.log('keys', Object.keys(e));
   console.log('json', JSON.stringify(e));
   console.log('json message', JSON.stringify(e.message));
}

function main() {
   // try {
   //    throw new Error('test error');
   // } catch (e) {
   //    logError(e);
   // }

   // try {
   //    throw new TypeError('test type error');
   // } catch (e) {
   //    logError(e);
   // }

   // try {
   //    throw new CustomError1('test custom 1', 'cause 1');
   // } catch (e) {
   //    logError(e);
   // }

   // try {
   //    throw new CustomError2('test custom 2', 'cause 2');
   // } catch (e) {
   //    logError(e);
   // }

   // try {
   //    throw new CustomError3({msg: 'custom 3', code: '1234'}, 'cause 3');
   // } catch (e) {
   //    logError(e);
   // }

   // try {
   //    throw new CustomError4({msg: 'custom 4', code: '5678'}, 'cause 4');
   // } catch (e) {
   //    logError(e);
   // }

   // try {
   //    throw new CustomError4('custom 4b', 'cause 4b');
   // } catch (e) {
   //    logError(e);
   // }

   try {
      throw new CustomError5('custom 5', 'cause 5');
   } catch (e) {
      logError(e);
   }

   try {
      throw new CustomError5b('custom 5b', 'cause 5b');
   } catch (e) {
      logError(e);
   }

   console.log(new Error().stack);
}

main();