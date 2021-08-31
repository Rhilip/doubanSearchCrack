import XXH from 'xxhashjs'
import { parseBPlist } from "./utils/bplist";
import RC4 from './utils/rc4';
import fixture from "./utils/fixture";

export type itemType = any

export interface searchData {
    start: number,
    total: number,
    error_info: string,
    count: number,
    report: {
        qtype: `${number}`,
        tags: string
    },
    text: string,
    items: itemType[]
}

// noinspection JSUnusedGlobalSymbols
export function extractDataFromPage(page: string): string {
    if (/window\.__DATA__ = "(.*)"/.test(page)) {
        return RegExp.$1
    }
    throw new Error("Can't find __DATA__ field from input.")
}

// noinspection JSUnusedGlobalSymbols
export default function decryptDoubanData(dataRawString: string): searchData {
    // 将网页字符串解析为base64
    const dataRaw = Buffer.from(dataRawString, 'base64')

    // 从base64中提取secKey，并整理生成需要解密的数据
    const i = 16
    const s = Math.max(Math.floor((dataRaw.length - 2 * 16) / 3), 0)
    const u = dataRaw.slice(s, s + i)

    const secKey = XXH.h64(u, 41405).toString(16)
    const encryptData = Buffer.concat([dataRaw.slice(0, s), dataRaw.slice(s + i)])

    // rc4解密
    const cipher = new RC4(secKey);
    const decryptData = cipher.update(encryptData);

    // BpList解密
    const bpList = parseBPlist(decryptData)

    // 对BpList的结果进行修正并返回
    return fixture.parse(bpList)
}
