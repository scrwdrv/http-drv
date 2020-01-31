/// <reference types="node" />
import * as http from 'http';
export declare namespace Server {
    type Methods = 'GET' | 'HEAD' | 'POST' | 'PUT' | 'DELETE' | 'CONNECT' | 'OPTIONS' | 'TRACE' | 'PATCH';
    type RouteHandler = (req: Server.Reqeust, res: Server.Response, next: () => void) => void;
    type SetRouteHandler = (path: string | RegExp, handler: Server.RouteHandler, secondHandler?: Server.RouteHandler) => void;
    type Events = 'error' | 'close';
    type EventListener<T> = T extends 'error' ? (err: Error) => void : T extends 'close' ? () => void : () => void;
    interface Options {
        trailingSlashRedirect?: boolean;
    }
    interface URL {
        query: {
            [key: string]: string;
        };
        path: string;
        search: string;
    }
    interface Route {
        match: (path: string) => boolean | {
            [key: string]: string;
        };
        handler: Server.RouteHandler;
        secondHandler: Server.RouteHandler;
    }
    interface Reqeust {
        method: Server.Methods;
        url: Server.URL;
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
    interface Response {
        redirect: (path: string, code?: number) => void;
        send: (content: string, code?: number) => void;
        json: (json: object, code?: number) => void;
        render: (data: object, id: string, dynamic: boolean, code?: number) => void;
        cookie: (name: string, value: string, opts?: {
            httpOnly?: boolean;
            secure?: boolean;
            maxAge?: number;
            path?: string;
        }) => void;
        file: (path: string, opts?: {
            maxAge?: number;
            onError?: (err: NodeJS.ErrnoException) => void;
        }) => void;
    }
}
export declare class server {
    all: Server.SetRouteHandler;
    get: Server.SetRouteHandler;
    head: Server.SetRouteHandler;
    post: Server.SetRouteHandler;
    put: Server.SetRouteHandler;
    delete: Server.SetRouteHandler;
    connect: Server.SetRouteHandler;
    options: Server.SetRouteHandler;
    trace: Server.SetRouteHandler;
    patch: Server.SetRouteHandler;
    private routes;
    private routesLength;
    private server;
    private listeners;
    private templates;
    constructor(opts?: Server.Options);
    private createServer;
    template(root: string, opts?: {
        developmentMode: boolean;
        id?: string;
    }): Promise<void>;
    static(path: string, root: string, opts?: {
        maxAge?: number;
    }): void;
    listen(port: number, host?: string, callback?: () => void): http.Server;
    on<T extends Server.Events>(evt: T, listener: Server.EventListener<T>): void;
    private emit;
}
