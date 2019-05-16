import ByteBuffer from 'bytebuffer';

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

interface IntFromBinary {
  string: string;
}

interface IntToBinary {
  object: object;
}


function toByteBuffer(type: { appendByteBuffer: (arg0: ByteBuffer, arg1: any) => void; }, object: object) {
  let b = new ByteBuffer(ByteBuffer.DEFAULT_CAPACITY, ByteBuffer.LITTLE_ENDIAN);
  type.appendByteBuffer(b, object);
  return b.copy(0, b.offset);
}

export default function (type: any) {
  return {
    fromHex(hex: IntFromHex['hex']) {
      let b = ByteBuffer.fromHex(hex, ByteBuffer.LITTLE_ENDIAN);
      return type.fromByteBuffer(b);
    },

    toHex(object: IntToHex['object']) {
      let b = toByteBuffer(type, object);
      return b.toHex();
    },

    fromBuffer(buffer: IntFromBuffer['buffer']) {
      let b = ByteBuffer.fromBinary(buffer.toString(), ByteBuffer.LITTLE_ENDIAN);
      return type.fromByteBuffer(b);
    },

    toBuffer(object: IntToBuffer['object']) {
      return Buffer.from(toByteBuffer(type, object).toBinary(), 'binary');
    },

    fromBinary(string: IntFromBinary['string']) {
      let b = ByteBuffer.fromBinary(string, ByteBuffer.LITTLE_ENDIAN);
      return type.fromByteBuffer(b);
    },

    toBinary(object: IntToBinary['object']) {
      return toByteBuffer(type, object).toBinary();
    }
  };
}
