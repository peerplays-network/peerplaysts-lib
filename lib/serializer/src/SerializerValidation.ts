import BigInteger from 'bigi';
import {Long} from 'bytebuffer';
import ChainTypes from '../../chain/src/ChainTypes';

let MAX_SAFE_INT = 9007199254740991;
let MIN_SAFE_INT = -9007199254740991;

/**
    Most validations are skipped and the value returned unchanged when an empty string,
    null, or undefined is encountered (except "required").
    Validations support a string format for dealing with large numbers.
*/

interface Int_No_Overflow64 {
  value: BigInteger | string | number
}

const _my = {
  is_empty(value: number | string) {
    return value === null || value === undefined;
  },

  required(value: number | string, field_name = '') {
    if (this.is_empty(value)) {
      throw new Error(`value required ${field_name} | ${value}`);
    }

    return value;
  },

  require_long(value: number, field_name = '') {
    if (!Long.isLong(value)) {
      throw new Error(`Long value required ${field_name} | ${value}`);
    }

    return value;
  },

  string(value: string) {
    if (this.is_empty(value)) {
      return value;
    }

    if (typeof value !== 'string') {
      throw new Error(`string required: ${value}`);
    }

    return value;
  },

  number(value: number) {
    if (this.is_empty(value)) {
      return value;
    }

    if (typeof value !== 'number') {
      throw new Error(`number required: ${value}`);
    }

    return value;
  },

  whole_number(value: string, field_name = '') {
    if (this.is_empty(value)) {
      return value;
    }

    if (/\./.test(value)) {
      throw new Error(`whole number required ${field_name} ${value}`);
    }

    return value;
  },
/**
 * returns string if it does not have a '-'
 * 
 * @param {string} value
 * @param {string} [field_name='']
 * @returns
 */
  unsigned(value: string, field_name = '') {
    if (this.is_empty(value)) {
      return value;
    }

    if (/-/.test(value)) {
      throw new Error(`unsigned required ${field_name} ${value}`);
    }

    return value;
  },

  is_digits(value: number) {
    if (typeof value === 'number') {
      return true;
    }

    return /^[0-9]+$/.test(value);
  },


/**
 * converts string to number, and checks for overflow
 * @param {string} value
 * @param {string} [field_name='']
 * @returns number
 */
  to_number(value: string | number, field_name = '') {
    if (this.is_empty(value)) {
      return value;
    }

    this.no_overflow53(value, field_name);
    let int_value = (() => {
      if (typeof value === 'number') {
        return value;
      }

      return parseInt(value, 10);
    })();
    return int_value;
  },

/**
 *converts string to long int
 *
 * @param {string} value
 * @param {string} [field_name='']
 * @returns
 */
  to_long(value: number | string, field_name = '') {
    if (this.is_empty(value)) {
      return value;
    }

    if (Long.isLong(value)) {
      return value;
    }

    this.no_overflow64(value, field_name);

    if (typeof value === 'number') {
      value = `${value}`;
    }

    return Long.fromString(value);
  },

  /**
   * Converts to unsigned long
   *
   * @param {(number | string)} value
   * @param {string} [field_name='']
   * @returns
   */
  to_ulong(value: number | string, field_name = '') {
    if (this.is_empty(value)) {
      return value;
    }

    if (Long.isLong(value)) {
      return value;
    }

    this.no_overflow64(value, field_name, true);

    if (typeof value === 'number') {
      value = `${value}`;
    }

    return Long.fromString(value, true);
  },

  /**
   * converts to string
   *
   * @param {(number | string)} value
   * @param {string} [field_name='']
   * @returns
   */
  to_string(value: number | string, field_name = '') {
    if (this.is_empty(value)) {
      return value;
    }

    if (typeof value === 'string') {
      return value;
    }

    if (typeof value === 'number') {
      this.no_overflow53(value, field_name);
      return `${value}`;
    }

    throw new Error(`unsupported type ${field_name}: (${typeof value}) ${value}`);
  },

  /**
   * tests if input string is accepted by input regex expression
   *
   * @param {RegExp} regex
   * @param {*} value
   * @param {string} [field_name='']
   * @returns input string, or throws error if no match is found
   */
  require_test(regex: RegExp, value: string, field_name = '') {
    if (this.is_empty(value)) {
      return value;
    }

    if (!regex.test(value)) {
      throw new Error(`unmatched ${regex} ${field_name} ${value}`);
    }

    return value;
  },

  /**
   * tests if input string is accepted by input regex expression
   *
   * @param {RegExp} regex
   * @param {string} value
   * @param {string} [field_name='']
   * @returns input string, or throws error if no match is found
   */
  require_match(regex: RegExp, value: string, field_name = '') {
    if (this.is_empty(value)) {
      return value;
    }

    let match = value.match(regex);

    if (match === null) {
      throw new Error(`unmatched ${regex} ${field_name} ${value}`);
    }

    return match;
  },

  /**
   * checks if input object id is in a valid id format
   *
   * @param {string} value
   * @param {string} field_name
   * @returns
   */
  require_object_id(value: string, field_name: string) {
    return this.require_match(/^([0-9]+)\.([0-9]+)\.([0-9]+)$/, value, field_name);
  },

  /**
   * checks if input number is within input range. does not support over 53 bits
   *
   * @param {number} min
   * @param {number} max
   * @param {(string | number)} value
   * @param {string} [field_name='']
   * @returns
   */
  require_range(min: number, max: number, value: string | number, field_name = '') {
    if (this.is_empty(value)) {
      return value;
    }

    let num = this.to_number(value);

    if (num < min || num > max) {
      throw new Error(`out of range ${value} ${field_name} ${value}`);
    }

    return value;
  },

  /**
   * type and value refers to type of object found in ChainTypes.js.
   * Throws error if type does not match value
   * @param {number} [reserved_spaces=1]
   * @param {string} type
   * @param {string} value
   * @param {string} [field_name='']
   * @returns
   */
  require_object_type(reserved_spaces = 1, type: string, value: string, field_name = '') {
    if (this.is_empty(value)) {
      return value;
    }

    let object_type = ChainTypes.object_type[type];

    if (!object_type) {
      throw new Error(`Unknown object type ${type} ${field_name} ${value}`);
    }

    let re = new RegExp(`${reserved_spaces}\.${object_type}\.[0-9]+$`);

    if (!re.test(value)) {
      throw new Error(
        `Expecting ${type} in format `
          + `${reserved_spaces}.${object_type}.[0-9]+ `
          + `instead of ${value} ${field_name} ${value}`
      );
    }

    return value;
  },

  get_instance(reserve_spaces: number, type: string, value: string, field_name?: '') {
    if (this.is_empty(value)) {
      return value;
    }

    this.require_object_type(reserve_spaces, type, value, field_name);
    return this.to_number(value.split('.')[2]);
  },

  //TODO: define types
  require_relative_type(type: any, value: any, field_name: any) {
    this.require_object_type(0, type, value, field_name);
    return value;
  },

  //TODO: define types
  get_relative_instance(type: any, value: any, field_name: any) {
    if (this.is_empty(value)) {
      return value;
    }

    this.require_object_type(0, type, value, field_name);
    return this.to_number(value.split('.')[2]);
  },

  //not used
  require_protocol_type(type: any, value: any, field_name: any) {
    this.require_object_type(1, type, value, field_name);
    return value;
  },

  //TODO: define types
  get_protocol_instance(type: any, value: any, field_name: any) {
    if (this.is_empty(value)) {
      return value;
    }

    this.require_object_type(1, type, value, field_name);
    return this.to_number(value.split('.')[2]);
  },

  //TODO: define types
  get_protocol_type(value: any, field_name: any) {
    if (this.is_empty(value)) {
      return value;
    }

    this.require_object_id(value, field_name);
    let values = value.split('.');
    return this.to_number(values[1]);
  },

  //TODO: define types
  get_protocol_type_name(value: any, field_name: any) {
    if (this.is_empty(value)) {
      return value;
    }

    let type_id = this.get_protocol_type(value, field_name);
    return Object.keys(ChainTypes.object_type)[type_id];
  },

  //TODO: define types
  require_implementation_type(type: any, value: any, field_name: any) {
    this.require_object_type(2, type, value, field_name);
    return value;
  },

  //TODO: define types
  get_implementation_instance(type: any, value: any , field_name: any) {
    if (this.is_empty(value)) {
      return value;
    }

    this.require_object_type(2, type, value, field_name);
    return this.to_number(value.split('.')[2]);
  },


  /**
   * checks to see if number is less than MIN_SAFE_INT or greater than MAX_SAFE_INT. 
   * if input is string, it is converted to number
   *
   * @param {(number | string)} value
   * @param {string} [field_name='']
   * @returns undefined or throws error on overflow
   */
  no_overflow53(value: number | string, field_name = '') {
    if (typeof value === 'number') {
      if (value > MAX_SAFE_INT || value < MIN_SAFE_INT) {
        throw new Error(`overflow ${field_name} ${value}`);
      }

      return;
    }

    if (typeof value === 'string') {
      let int = parseInt(value, 10);

      if (int > MAX_SAFE_INT || int < MIN_SAFE_INT) {
        throw new Error(`overflow ${field_name} ${int}`);
      }

      return;
    }
    
    //unreachable code
    // if (Long.isLong(value)) {
    //   // typeof value.toInt() is 'number'
    //   this.no_overflow53(value.toInt(), field_name);
    //   return;
    // }

    throw new Error(`unsupported type ${field_name}: (${typeof value}) ${value}`);
  },


/**
 * if input is bigInteger, or string and is greater than LONG it will cause overflow error. 
 * if input is number and less than MIN_SAFE_INT or greater than MAX_SAFE_INT, overflow will occur. 
 * Otherwise it returns undefined
 *
 * @param {(BigInteger | string | number)} value
 * @param {string} [field_name='']
 * @param {boolean} [unsigned=false]
 * @returns undefined or throws error on overflow
 */
  no_overflow64(value: Int_No_Overflow64['value'], field_name = '', unsigned = false) {
    // https://github.com/dcodeIO/Long.js/issues/20
    if (Long.isLong(value)) {
      return;
    }

    // replaced check for big integer with isBigInteger as it was recently added to bigi library
    if (BigInteger.isBigInteger(value, '')) {
      this.no_overflow64(value.toString(), field_name, unsigned);
      return;
    }

    if (typeof value === 'string') {
      // remove leading zeros, will cause a false positive
      value = value.replace(/^0+/, '');

      // remove trailing zeros
      while (/0$/.test(value)) {
        value = value.substring(0, value.length - 1);
      }

      if (/\.$/.test(value)) {
        // remove trailing dot
        value = value.substring(0, value.length - 1);
      }

      if (value === '') {
        value = '0';
      }

      let long_string = Long.fromString(value, unsigned).toString();

      if (long_string !== value.trim()) {
        throw new Error(`overflow ${field_name} ${value}`);
      }

      return;
    }

    if (typeof value === 'number') {
      if (value > MAX_SAFE_INT || value < MIN_SAFE_INT) {
        throw new Error(`overflow ${field_name} ${value}`);
      }

      return;
    }

    throw new Error(`unsupported type ${field_name}: (${typeof value}) ${value}`);
  }
};

export default _my;
