declare module "node:sqlite" {
  export class DatabaseSync {
    constructor(path: string);
    exec(sql: string): void;
    prepare(sql: string): {
      get(...params: any[]): unknown;
      all(...params: any[]): unknown[];
      run(...params: any[]): { lastInsertRowid: number | bigint; changes: number };
    };
  }
}
