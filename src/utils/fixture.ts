// @ts-nocheck
interface KVRecord {
    k: any[],
    z?: any[]
}

const p = {
    start: 2,
    end: 7
}

class Fixture {
    private data;

    readonly defaultRootUID = 4;

    parse(data) {
        this.data = data;
        return this.fixRecord(this.getRealUID(this.data[this.defaultRootUID]))
    }

    getRealUID(t) {
        if (t >= p.start) {
            const e = p.end - p.start;
            if (t < p.end) return t + e;
            if (t < p.end + e) return t - e
        }
        return t
    }

    getRealObject(t) {
        return this.data[this.getRealUID(t)]
    }

    fixRecord(record: any): any {
        if (Array.isArray(record)) {
            return record.map(x => this.fixRecord(x))
        } else if (typeof record === 'object' && record !== null) {
            return this.fixObject(record)
        } else if (record instanceof Buffer) {
            if (record[record.length - 1] === 0) {
                record = record.slice(0, record.length - 1)
            }

            return record.toString()
        } else {
            return record
        }
    }

    // {k: [ 40, 27, 35, 50, 52, 44 ] }
    // {k: [ '', [] ] , z: [ 44, 55 ] }
    // {k: [ '', [] , {j: 55} ], z: [ 44, 66, 88 ]}
    fixObject(rawObject: any): any {
        if (Object.keys(rawObject).length === 1 && ('j' in rawObject)) {
            return this.fixJObject(rawObject)
        } else if ('k' in rawObject) {
            const {k,z} = rawObject as KVRecord
            if (typeof z === 'undefined') { // {k: [ 40, 27, 35, 50, 52, 44 ] }
                return k.map(value => this.fixRecord(this.data[value]))
            } else { // {k: [ '', [] ] , z: [ 44, 55 ] }
                const ret = {}
                z.forEach(((value, index) => {
                    ret[this.getRealObject(value)] = this.fixRecord(k[index])
                }))
                return ret
            }
        }
        return rawObject
    }

    fixJObject(rawJObject: { j: number }): any {
        return this.fixRecord(this.getRealObject(rawJObject.j))
    }
}

export default new Fixture()
