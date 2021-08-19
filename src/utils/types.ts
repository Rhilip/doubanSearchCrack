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
