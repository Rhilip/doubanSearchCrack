// @ts-nocheck
/**
 * Since We can't Monkey patching the bplist-parser, so just
 * Edit from `node-bplist-parser` (The MIT License)
 */

const maxObjectSize = 100 * 1000 * 1000; // 100Meg
const maxObjectCount = 32768;

// EPOCH = new SimpleDateFormat("yyyy MM dd zzz").parse("2001 01 01 GMT").getTime();
// ...but that's annoying in a static initializer because it can throw exceptions, ick.
// So we just hardcode the correct value.
const EPOCH = 978307200000;

// UID object definition
function UID(id: number) {
    this.UID = id;
}

function readUInt(buffer: Buffer, start = 0) {
    return buffer.readUIntBE(start, buffer.length);
}

export function parseBPlist(buffer: Buffer) {
    const trailer = buffer.slice(buffer.length - 32, buffer.length);
    // 6 null bytes (index 0 to 5)
    const offsetSize = trailer.readUInt8(6);
    const objectRefSize = trailer.readUInt8(7);
    const numObjects = Number(trailer.readBigUInt64BE(8));
    const topObject = Number(trailer.readBigUInt64BE(16));
    const offsetTableOffset = Number(trailer.readBigUInt64BE(24));

    if (numObjects > maxObjectCount) {
        throw new Error("maxObjectCount exceeded");
    }

    // Handle offset table
    const offsetTable = [];

    for (let i = 0; i < numObjects; i++) {
        const offsetBytes = buffer.slice(offsetTableOffset + i * offsetSize, offsetTableOffset + (i + 1) * offsetSize);
        offsetTable[i] = readUInt(offsetBytes, 0);
    }

    // Parses an object inside the currently parsed binary property list.
    // For the format specification check
    // <a href="https://www.opensource.apple.com/source/CF/CF-635/CFBinaryPList.c">
    // Apple's binary property list parser implementation</a>.
    function parseObject(tableOffset) {
        const offset = offsetTable[tableOffset];
        const type = buffer[offset];
        const objType = (type & 0xF0) >> 4; //First  4 bits
        const objInfo = (type & 0x0F);      //Second 4 bits
        switch (objType) {
            case 0x0:
                return parseSimple();
            case 0x1:
                return parseInteger();
            case 0x8:
                return parseUID();
            case 0x2:
                return parseReal();
            case 0x3:
                return parseDate();
            case 0x6:
                return parseData();
            case 0x4: // ASCII
                return parsePlistString();
            case 0x5: // UTF-16
                return parsePlistString(1);
            case 0xA:
                return parseArray();
            case 0xD:
                return parseDictionary();
            default:
                throw new Error("Unhandled type 0x" + objType.toString(16));
        }

        function parseSimple() {
            //Simple
            switch (objInfo) {
                case 0x0: // null
                    return null;
                case 0x8: // false
                    return false;
                case 0x9: // true
                    return true;
                case 0xF: // filler byte
                    return null;
                default:
                    throw new Error("Unhandled simple type 0x" + objType.toString(16));
            }
        }

        function parseInteger() {
            const length = Math.pow(2, objInfo);
            if (length < maxObjectSize) {
                const data = buffer.slice(offset + 1, offset + 1 + length) as Buffer;
                return data.reduce((acc, curr) => {
                    acc <<= 8;
                    acc |= curr & 255;
                    return acc;
                });
            } else {
                throw new Error("Too little heap space available! Wanted to read " + length + " bytes, but only " + maxObjectSize + " are available.");
            }
        }

        function parseUID() {
            const length = objInfo + 1;
            if (length < maxObjectSize) {
                return new UID(readUInt(buffer.slice(offset + 1, offset + 1 + length)));
            }
            throw new Error("Too little heap space available! Wanted to read " + length + " bytes, but only " + maxObjectSize + " are available.");
        }

        function parseReal() {
            const length = Math.pow(2, objInfo);
            if (length < maxObjectSize) {
                const realBuffer = buffer.slice(offset + 1, offset + 1 + length);
                if (length === 4) {
                    return realBuffer.readFloatBE(0);
                }
                if (length === 8) {
                    return realBuffer.readDoubleBE(0);
                }
            } else {
                throw new Error("Too little heap space available! Wanted to read " + length + " bytes, but only " + maxObjectSize + " are available.");
            }
        }

        function parseDate() {
            if (objInfo != 0x3) {
                console.error("Unknown date type :" + objInfo + ". Parsing anyway...");
            }
            const dateBuffer = buffer.slice(offset + 1, offset + 9);
            return new Date(EPOCH + (1000 * dateBuffer.readDoubleBE(0)));
        }

        function parseData() {
            let dataoffset = 1;
            let length = objInfo;
            if (objInfo == 0xF) {
                const int_type = buffer[offset + 1];
                const intType = (int_type & 0xF0) / 0x10;
                if (intType != 0x1) {
                    console.error("0x4: UNEXPECTED LENGTH-INT TYPE! " + intType);
                }
                const intInfo = int_type & 0x0F;
                const intLength = Math.pow(2, intInfo);
                dataoffset = 2 + intLength;
                if (intLength < 3) {
                    length = readUInt(buffer.slice(offset + 2, offset + 2 + intLength));
                } else {
                    length = readUInt(buffer.slice(offset + 2, offset + 2 + intLength));
                }
            }
            if (length < maxObjectSize) {
                return buffer.slice(offset + dataoffset, offset + dataoffset + length);
            }
            throw new Error("Too little heap space available! Wanted to read " + length + " bytes, but only " + maxObjectSize + " are available.");
        }

        function parsePlistString(isUtf16 = 0) {
            let enc = "utf8";
            let length = objInfo;
            let stroffset = 1;
            if (objInfo == 0xF) {
                const int_type = buffer[offset + 1];
                const intType = (int_type & 0xF0) / 0x10;
                if (intType != 0x1) {
                    console.error("UNEXPECTED LENGTH-INT TYPE! " + intType);
                }
                const intInfo = int_type & 0x0F;
                const intLength = Math.pow(2, intInfo);
                stroffset = 2 + intLength;
                if (intLength < 3) {
                    length = readUInt(buffer.slice(offset + 2, offset + 2 + intLength));
                } else {
                    length = readUInt(buffer.slice(offset + 2, offset + 2 + intLength));
                }
            }
            // length is String length -> to get byte length multiply by 2, as 1 character takes 2 bytes in UTF-16
            length *= (isUtf16 + 1);
            if (length < maxObjectSize) {
                let plistString = Buffer.from(buffer.slice(offset + stroffset, offset + stroffset + length));
                if (isUtf16) {
                    plistString = plistString.swap16();
                    enc = "ucs2";
                }
                // @ts-ignore
                return plistString.toString(enc);
            }
            throw new Error("Too little heap space available! Wanted to read " + length + " bytes, but only " + maxObjectSize + " are available.");
        }

        function parseArray() {
            let length = objInfo;
            let arrayoffset = 1;
            if (objInfo == 0xF) {
                const int_type = buffer[offset + 1];
                const intType = (int_type & 0xF0) / 0x10;
                if (intType != 0x1) {
                    console.error("0xa: UNEXPECTED LENGTH-INT TYPE! " + intType);
                }
                const intInfo = int_type & 0x0F;
                const intLength = Math.pow(2, intInfo);
                arrayoffset = 2 + intLength;
                if (intLength < 3) {
                    length = readUInt(buffer.slice(offset + 2, offset + 2 + intLength));
                } else {
                    length = readUInt(buffer.slice(offset + 2, offset + 2 + intLength));
                }
            }
            if (length * objectRefSize > maxObjectSize) {
                throw new Error("Too little heap space available!");
            }
            const array = [];
            for (let i = 0; i < length; i++) {
                const objRef = readUInt(buffer.slice(offset + arrayoffset + i * objectRefSize, offset + arrayoffset + (i + 1) * objectRefSize));
                array[i] = parseObject(objRef);
            }
            return array;
        }

        function parseDictionary() {
            let length = objInfo;
            let dictoffset = 1;
            if (objInfo == 0xF) {
                const int_type = buffer[offset + 1];
                const intType = (int_type & 0xF0) / 0x10;
                if (intType != 0x1) {
                    console.error("0xD: UNEXPECTED LENGTH-INT TYPE! " + intType);
                }
                const intInfo = int_type & 0x0F;
                const intLength = Math.pow(2, intInfo);
                dictoffset = 2 + intLength;
                if (intLength < 3) {
                    length = readUInt(buffer.slice(offset + 2, offset + 2 + intLength));
                } else {
                    length = readUInt(buffer.slice(offset + 2, offset + 2 + intLength));
                }
            }
            if (length * 2 * objectRefSize > maxObjectSize) {
                throw new Error("Too little heap space available!");
            }
            const dict = {};
            for (let i = 0; i < length; i++) {
                const keyRef = readUInt(buffer.slice(offset + dictoffset + i * objectRefSize, offset + dictoffset + (i + 1) * objectRefSize));
                const valRef = readUInt(buffer.slice(offset + dictoffset + (length * objectRefSize) + i * objectRefSize, offset + dictoffset + (length * objectRefSize) + (i + 1) * objectRefSize));
                const key = parseObject(keyRef);
                dict[key] = parseObject(valRef);
            }
            return dict;
        }
    }

    return parseObject(topObject);
}

