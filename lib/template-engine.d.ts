export interface Renderer {
    dynamic: (data: object) => object;
    static: (data: object) => string;
}
export declare function update(path: string): Promise<Renderer>;
