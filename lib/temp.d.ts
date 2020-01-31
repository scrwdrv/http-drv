/// <reference types="node" />
import * as http from 'http';
declare type HTTPMethods = 'GET' | 'HEAD' | 'POST' | 'PUT' | 'DELETE' | 'CONNECT' | 'OPTIONS' | 'TRACE' | 'PATCH';
declare type RouteHandler = (req: HTTPReqeust, res: HTTPResponse, next: () => void) => void;
declare type SetRouteHandler = (path: string | RegExp, handler: RouteHandler, secondHandler?: RouteHandler) => void;
declare global {
    interface HTTPReqeust {
        method: HTTPMethods;
        url: URL;
        params: {
            [key: string]: string;
        };
        body: {
            [key: string]: any;
        };
        ip: string;
        cookie: {
            [key: string]: string;
        };
        langs: string[];
        [customKey: string]: any;
    }
    interface HTTPResponse {
        redirect: (path: string, code?: number) => void;
        send: (content: string, code?: number) => void;
        json: (json: object, code?: number) => void;
        render: (json: object, templateId: string, dynamic: boolean, code?: number) => void;
        cookie: (name: string, value: string, maxAge?: number) => void;
        file: (path: string, maxAge?: number, onError?: (err: any) => void) => void;
    }
}
interface URL {
    query: {
        [key: string]: string;
    };
    path: string;
    search: string;
}
export declare class HTTPServer {
    private routes;
    private routesLength;
    private hits;
    private templates;
    all: SetRouteHandler;
    get: SetRouteHandler;
    head: SetRouteHandler;
    post: SetRouteHandler;
    put: SetRouteHandler;
    delete: SetRouteHandler;
    connect: SetRouteHandler;
    options: SetRouteHandler;
    trace: SetRouteHandler;
    patch: SetRouteHandler;
    server: http.Server;
    constructor();
    static(path: string, root: string, maxAge?: number): void;
    render<T extends true | false>(json: object, templateId: string, dynamic: T): T extends true ? object : string;
    updateTemplate(id: string): Promise<unknown>;
    template(directory: string, developmentMode?: boolean): void;
    getHits(): {
        [ip: string]: number;
    };
    listen(port: number, host?: string, callback?: () => void): http.Server;
}
export {};
