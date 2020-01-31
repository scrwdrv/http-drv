export interface Renderer {
    dynamic: (data: object) => object;
    static: (data: object) => string;
}
export declare function getTemplate(path: string): Promise<Renderer>;
