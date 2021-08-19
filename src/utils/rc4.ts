/**
 * Edit from `simple-rc4` (The MIT License)
 */
export default class RC4 {
    _box;
    _i;
    _j;

    constructor(keyRaw: string) {
        const box = Buffer.alloc(0x100);
        const key = Buffer.from(keyRaw);

        let k, l = 0, s;
        for (k = 0; k < 0x100; k += 1) {
            box[k] = k;
        }
        // swap box using key
        for (k = 0; k < 0x100; k += 1) {
            l = (l + box[k] + key[k % key.length]) % 0x100;
            // swap box[k] and box[l]
            s = box[k];
            box[k] = box[l];
            box[l] = s;
        }

        this._box = box;
        this._i = 0;
        this._j = 0;
    }

    update(msg: Buffer): Buffer {
        let i, j, k, s, box = this._box;
        for (k = 0; k < msg.length; k += 1) {
            i = (this._i + 1) % 0x100;
            j = (this._j + this._box[i]) % 0x100;
            // swap box[i] and box[j]
            s = box[i];
            box[i] = box[j];
            box[j] = s;
            msg[k] ^= box[(box[i] + box[j]) % 0x100];
            this._i = i;
            this._j = j;
        }
        return msg;
    }
}
