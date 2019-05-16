import ByteBuffer from 'bytebuffer';
import EC from './error_with_cause';
import { stringify } from 'querystring';

const HEX_DUMP = process.env.npm_config__graphene_serializer_hex_dump;

interface IntSerializerConstructor {
  operation_name: string,
  types: { [x: string]: any; },
  keys: { [x: string]: any; }
}

interface IntFromHex {
  hex: string;
};

interface IntToHex {
  object: object;
};

interface IntFromBuffer {
  buffer: object;
};

interface IntToBuffer {
  object: object;
};

interface IntCompare {
  a: { [x: string]: any; },
  b: { [x: string]: any; }
}

interface IntOperation {
  operation: string;
}

interface IntByteBuffer {
  b: ByteBuffer,
  object: { [x: string]: any; }
}
class Serializer {
  //field
  keys: IntSerializerConstructor['keys'];
  types: IntSerializerConstructor['types'];
  operation_name: IntOperation['operation'];
  //constructor
  constructor(operation_name: IntSerializerConstructor['operation_name'], types: IntSerializerConstructor['types']) {
    this.operation_name = operation_name;
    this.types = types;
    
    if (types) {
      this.keys = Object.keys(types);
    }
    //unclear how this works
    Serializer.printDebug = true;
  }

  fromByteBuffer(b: ByteBuffer) {
    let object:{ [x: string]: any; };
    object = {['']:''}
    let field = null;

    try {
      let iterable = this.keys;

      for (let i = 0; i < iterable.length; i++) {
        field = iterable[i];
        let type = this.types[field];

        try {
          if (HEX_DUMP) {
            if (type.operation_name) {
              console.error(type.operation_name);
            } else {
              let o1 = b.offset;
              type.fromByteBuffer(b);
              let o2 = b.offset;
              b.offset = o1;
              // b.reset()
              let _b = b.copy(o1, o2);
              console.error(`${this.operation_name}.${field}\t`, _b.toHex());
            }
          }

          object[field] = type.fromByteBuffer(b);
        } catch (e) {
          if (Serializer.printDebug) {
            console.error(`Error reading ${this.operation_name}.${field} in data:`);
            b.printDebug();
          }

          throw e;
        }
      }
    } catch (error) {
      EC.throw(`${this.operation_name}.${field}`, error);
    }

    return object;
  }

  appendByteBuffer(b: IntByteBuffer['b'], object: IntByteBuffer['object']) {
    let field = null;

    try {
      let iterable = this.keys;

      for (let i = 0; i < iterable.length; i++) {
        field = iterable[i];
        let type = this.types[field];
        type.appendByteBuffer(b, object[field]);
      }
    } catch (error) {
      try {
        EC.throw(`${this.operation_name}.${field} = ${JSON.stringify(object[field])}`, error);
      } catch (e) {
        // circular ref
        EC.throw(`${this.operation_name}.${field} = ${object[field]}`, error);
      }
    }
  }

  fromObject(serialized_object: { [x: string]: any; }) {
    let result = [];
    let field = null;

    try {
      let iterable = this.keys;

      for (let i = 0; i < iterable.length; i++) {
        field = iterable[i];
        let type = this.types[field];
        let value = serialized_object[field];
        // DEBUG value = value.resolve if value.resolve
        // DEBUG console.log('... value',field,value)
        let object = type.fromObject(value);
        result[field] = object;
      }
    } catch (error) {
      EC.throw(`${this.operation_name}.${field}`, error);
    }

    return result;
  }

  /**
        @arg {boolean} [debug.use_default = false] - more template friendly
        @arg {boolean} [debug.annotate = false] - add user-friendly information
    */
  toObject(serialized_object: { [x: string]: any; }, debug = {use_default: false, annotate: false}) {
    let result = ['',''];
    let field = null;

    try {
      if (!this.types) {
        return result;
      }

      let iterable = this.keys;

      for (let i = 0; i < iterable.length; i++) {
        field = iterable[i];
        let type = this.types[field];
        let object = type.toObject(
          typeof serialized_object !== 'undefined' && serialized_object !== null
            ? serialized_object[field]
            : undefined,
          debug
        );
        result[field] = object;

        if (HEX_DUMP) {
          let b = new ByteBuffer(ByteBuffer.DEFAULT_CAPACITY, ByteBuffer.LITTLE_ENDIAN);
          type.appendByteBuffer(
            b,
            typeof serialized_object !== 'undefined' && serialized_object !== null
              ? serialized_object[field]
              : undefined
          );
          b = b.copy(0, b.offset);
          console.error(`${this.operation_name}.${field}`, b.toHex());
        }
      }
    } catch (error) {
      EC.throw(`${this.operation_name}.${field}`, error);
    }

    return result;
  }

  /** Sort by the first element in a operation */
  compare(a: IntCompare['a'], b: IntCompare['b']) {
    let first_key = this.keys[0];
    let first_type = this.types[first_key];

    let valA = a[first_key];
    let valB = b[first_key];

    if (first_type.compare) {
      return first_type.compare(valA, valB);
    }

    if (typeof valA === 'number' && typeof valB === 'number') {
      return valA - valB;
    }

    let encoding;

    if (Buffer.isBuffer(valA) && Buffer.isBuffer(valB)) {
      // A binary string compare does not work.  If localeCompare is well supported that could
      // replace HEX.  Performanance is very good so comparing HEX works.
      encoding = 'hex';
    }

    let strA = valA.toString(encoding);
    let strB = valB.toString(encoding);

    let result = 0;

    if (strA > strB) {
      result = 1;
    }

    if (strA < strB) {
      result = -1;
    }

    return result;
  }

  // <helper_functions>

  fromHex(hex: IntFromHex['hex']) {
    let b = ByteBuffer.fromHex(hex, ByteBuffer.LITTLE_ENDIAN);
    return this.fromByteBuffer(b);
  }

  fromBuffer(buffer: IntFromBuffer['buffer']) {
    let b = ByteBuffer.fromBinary(buffer.toString('binary'), ByteBuffer.LITTLE_ENDIAN);
    return this.fromByteBuffer(b);
  }

  toHex(object: IntToHex['object']) {
    // return this.toBuffer(object).toString("hex")
    let b = this.toByteBuffer(object);
    return b.toHex();
  }

  toByteBuffer(object: IntToBuffer['object']) {
    let b = new ByteBuffer(ByteBuffer.DEFAULT_CAPACITY, ByteBuffer.LITTLE_ENDIAN);
    this.appendByteBuffer(b, object);
    return b.copy(0, b.offset);
  }

  toBuffer(object: IntToBuffer['object']) {
    return Buffer.from(this.toByteBuffer(object).toBinary(), 'binary');
  }
}

export default Serializer;
