/** Exception nesting.  */

interface IntConstructor {
  message: string, 
  cause: { message: string; stack: string; }
}

interface IntThrow {
  message: string, 
  cause: { message: string; stack: string; }
}
class ErrorWithCause {
  constructor(message: IntConstructor['message'], cause: IntConstructor['cause']) {
    message = message;

    if (typeof cause !== 'undefined' && cause !== null ? cause.message : undefined) {
      message = `cause\t${cause.message}\t${message}`;
    }

    let stack:string = ''; // (new Error).stack

    if (typeof cause !== 'undefined' && cause !== null ? cause.stack : undefined) {
      stack = `caused by\n\t${cause.stack}\t${stack}`;
    }

    stack = `${message}\n${stack}`;
  }

  static throw(message: IntThrow['message'], cause: IntThrow['cause']) {
    let msg = message;

    if (typeof cause !== 'undefined' && cause !== null ? cause.message : undefined) {
      msg += `\t cause: ${cause.message} `;
    }

    if (typeof cause !== 'undefined' && cause !== null ? cause.stack : undefined) {
      msg += `\n stack: ${cause.stack} `;
    }

    throw new Error(msg);
  }
}

export default ErrorWithCause;
