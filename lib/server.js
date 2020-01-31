"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const http = require("http");
const regex = require("simple-regex-toolkit");
const PATH = require("path");
const query_string_1 = require("query-string");
const mime = require("mime-types");
const template = require("./template-engine");
class server {
    constructor(opts = {}) {
        this.routes = {};
        this.routesLength = {};
        this.listeners = {};
        this.templates = {};
        this.createServer(opts);
        const methods = ['ALL', 'GET', 'HEAD', 'POST', 'PUT', 'DELETE', 'CONNECT', 'OPTIONS', 'TRACE', 'PATCH'];
        for (let i = methods.length; i--;) {
            if (methods[i] !== 'ALL') {
                this.routes[methods[i]] = [];
                this.routesLength[methods[i]] = 0;
            }
            this[methods[i].toLowerCase()] = (path, handler, secondHandler) => {
                let route = {
                    match: undefined,
                    handler: handler,
                    secondHandler: secondHandler
                };
                if (typeof path === 'string') {
                    const segments = path.split('*'), segmentsLength = segments.length;
                    let regexString = '', params = [];
                    for (let i = 0; i < segmentsLength; i++)
                        if (i !== segmentsLength - 1)
                            regexString += `${handleParams(segments[i])}.*`;
                        else
                            regexString += handleParams(segments[i]);
                    function handleParams(str) {
                        const subParams = str.match(/(?<=\/:)\w+\?*/g), arr = str.split(/\/:\w+\?*/);
                        let subRegexString = '';
                        for (let i = 0, l = arr.length; i < l; i++) {
                            let reg = '';
                            if (subParams && subParams[i])
                                if (/\?$/.test(subParams[i])) {
                                    reg = '(?:\\/((?:(?!\\/).)+))*';
                                    params.push(subParams[i].slice(0, -1));
                                }
                                else {
                                    reg = '\\/((?:(?!\\/).)+)';
                                    params.push(subParams[i]);
                                }
                            subRegexString += regex.escape(arr[i]) + reg;
                        }
                        return subRegexString;
                    }
                    const reg = regex.from('/' + regexString + '/' + (/[A-z]/.test(regexString) ? 'i' : '')), paramsLength = params.length;
                    if (paramsLength)
                        route.match = p => {
                            const match = reg.exec(p);
                            if (!match)
                                return false;
                            let r = {};
                            for (let i = 0; i < paramsLength; i++)
                                r[params[i]] = match[i + 1];
                            return r;
                        };
                    else if (segmentsLength > 1)
                        route.match = p => {
                            return reg.test(p);
                        };
                    else
                        route.match = p => {
                            return p === path ? true : false;
                        };
                    if (methods[i] !== 'ALL') {
                        this.routes[methods[i]].push(route);
                        this.routesLength[methods[i]]++;
                    }
                    else
                        for (let i = methods.length; i--;)
                            if (methods[i] !== 'ALL') {
                                this.routes[methods[i]].push(route);
                                this.routesLength[methods[i]]++;
                            }
                }
            };
        }
    }
    createServer(opts) {
        this.server = http.createServer(async (req, res) => {
            helmetOn();
            const url = parseURL();
            if (removeTrailingSlash() && opts.trailingSlashRedirect) {
                res.writeHead(301, { 'Location': url.path.slice(0, -1) + url.search });
                return res.end();
            }
            ;
            const request = {
                method: req.method,
                url: url,
                params: {},
                body: await getBody(),
                ip: getIP(),
                cookie: getCookies(),
                langs: getAcceptLangs()
            }, response = {
                redirect: (path, code = 302) => {
                    if (res.finished)
                        throw new Error('can\'t write data after stream ended');
                    res.writeHead(code, {
                        'Location': path
                    });
                    res.end();
                },
                send: (content, code = 200) => {
                    if (res.finished)
                        throw new Error('can\'t write data after stream ended');
                    res.writeHead(code, {
                        'Content-Type': 'text/html; charset=UTF-8',
                        'Cache-Control': 'no-cache'
                    });
                    res.end(content);
                },
                json: (json, code = 200) => {
                    if (res.finished)
                        throw new Error('can\'t write data after stream ended');
                    res.writeHead(code, {
                        'Content-Type': 'application/json; charset=UTF-8',
                        'Cache-Control': 'no-cache'
                    });
                    res.end(JSON.stringify(json));
                },
                render: (data, id, dynamic, code = 200) => {
                    if (res.finished)
                        throw new Error('can\'t write data after stream ended');
                    dynamic ? response.json(this.templates[id].dynamic(data), code) :
                        response.send(this.templates[id].static(data), code);
                },
                cookie: (name, value, opts = {}) => {
                    if (res.finished)
                        throw new Error('can\'t write data after stream ended');
                    res.setHeader('Set-Cookie', `${name}=${value};max-age=${opts.maxAge || 31556952};path="${opts.path || '/'}"${opts.httpOnly === false ? '' : ';HttpOnly'}${opts.secure === false ? '' : ';Secure'} `);
                },
                file: (path, opts = {}) => {
                    if (res.finished)
                        throw new Error('can\'t write data after stream ended');
                    fs.stat(path, (err, stats) => {
                        if (err)
                            return opts.onError ? opts.onError(err) : res.writeHead(404).end();
                        if (req.headers.range) {
                            const range = req.headers.range.slice(req.headers.range.indexOf('=') + 1).split('-'), from = parseInt(range[0]), to = range[1] ? parseInt(range[1]) : stats.size - 1;
                            res.writeHead(206, {
                                'Content-Range': `bytes ${from}-${to}/${stats.size}`,
                                'Accept-Ranges': 'bytes',
                                'Content-Length': to - from + 1,
                                'Content-Type': mime.contentType(PATH.extname(path)) || 'text/html; charset=UTF-8',
                                'Cache-Control': opts.maxAge ? `max-age=${opts.maxAge}` : 'no-cache'
                            });
                            fs.createReadStream(path, { start: from, end: to })
                                .on('error', opts.onError || (() => { }))
                                .pipe(res);
                        }
                        else {
                            res.writeHead(200, {
                                'Content-Length': stats.size,
                                'Content-Type': mime.contentType(PATH.extname(path)) || 'text/html; charset=UTF-8',
                                'Cache-Control': opts.maxAge ? `max-age=${opts.maxAge}` : 'no-cache'
                            });
                            fs.createReadStream(path)
                                .on('error', opts.onError || (() => { }))
                                .pipe(res);
                        }
                    });
                }
            }, findRoute = (index = 0) => {
                for (let i = index; i < this.routesLength[req.method]; i++) {
                    const match = this.routes[req.method][i].match(url.path);
                    if (match) {
                        if (typeof match === 'object')
                            request.params = match;
                        const next = () => findRoute(i + 1);
                        return this.routes[req.method][i].handler(request, response, this.routes[req.method][i].secondHandler ? () => this.routes[req.method][i].secondHandler(request, response, next) : next);
                    }
                }
                return res.writeHead(404).end();
            };
            findRoute();
            function removeTrailingSlash() {
                const upL = url.path.length;
                if (upL > 1 && url.path[upL - 1] === '/') {
                    url.path = url.path.slice(0, -1);
                    return true;
                }
                return false;
            }
            function getBody() {
                return new Promise(resolve => {
                    const contentType = (req.headers['content-type'] || '').toLowerCase();
                    let data = '';
                    if (contentType.indexOf('application/json') > -1)
                        req.setEncoding('utf8')
                            .on('data', c => data += c)
                            .on('end', () => {
                            try {
                                resolve(JSON.parse(data));
                            }
                            catch (err) {
                                resolve({});
                            }
                        });
                    else if (contentType.indexOf('application/x-www-form-urlencoded') > -1)
                        req.setEncoding('utf8')
                            .on('data', c => data += c)
                            .on('end', () => resolve(query_string_1.parse(data)));
                    else
                        resolve({});
                });
            }
            function getIP() {
                if (req.headers['x-forwarded-for'])
                    if (typeof req.headers['x-forwarded-for'] === 'string')
                        return req.headers['x-forwarded-for'].split(',')[0].trim();
                    else
                        return req.headers['x-forwarded-for'][0];
                else
                    return req.connection.remoteAddress;
            }
            function getCookies() {
                if (!req.headers.cookie)
                    return {};
                let cA = req.headers.cookie.split(';'), c = {};
                for (let i = cA.length; i--;) {
                    cA[i] = cA[i].trim();
                    let cI = cA[i].indexOf('=');
                    c[cA[i].slice(0, cI)] = cA[i].slice(cI + 1);
                }
                return c;
            }
            function getAcceptLangs() {
                if (!req.headers["accept-language"])
                    return [];
                const pairs = req.headers["accept-language"].split(',');
                let langs = [], langsQ = {};
                for (let i = 0, l = pairs.length; i < l; i++) {
                    if (!pairs[i])
                        continue;
                    const pair = pairs[i].split(';');
                    langs.push(pair[0]);
                    langsQ[pair[0]] = pair[1] ? parseFloat(pair[1].slice(pair[1].indexOf('=') + 1)) : 1;
                }
                return langs.sort((a, b) => {
                    return langsQ[b] - langsQ[a];
                });
            }
            function helmetOn() {
                res.setHeader('X-Frame-Options', 'sameorigin');
                res.setHeader('X-XSS-Protection', '1; mode=block');
                res.setHeader('X-Download-Options', 'noopen');
                res.setHeader('X-Content-Type-Options', 'nosniff');
                res.setHeader('X-DNS-Prefetch-Control', 'off');
                res.setHeader('Strict-Transport-Security', 'max-age=31556952; includeSubDomains');
            }
            function parseURL() {
                try {
                    req.url = decodeURIComponent(req.url);
                }
                catch (err) { }
                let url = {
                    query: {},
                    path: req.url,
                    search: ''
                };
                const queryIndex = req.url.indexOf('?');
                if (queryIndex > -1) {
                    url.path = req.url.slice(0, queryIndex);
                    url.search = req.url.slice(queryIndex);
                    const queries = req.url.slice(queryIndex + 1).split('&');
                    for (let i = queries.length; i--;) {
                        if (!queries[i])
                            continue;
                        const valIndex = queries[i].indexOf('=');
                        if (valIndex === -1)
                            continue;
                        const key = queries[i].slice(0, valIndex), val = queries[i].slice(valIndex + 1);
                        if (!key || !val)
                            continue;
                        url.query[key] = val;
                    }
                }
                return url;
            }
        });
    }
    async template(root, opts = { developmentMode: false }) {
        const files = fs.readdirSync(root);
        let paths = [];
        for (let i = files.length; i--;) {
            const file = /.+(?=\.template$)/.exec(files[i]), path = PATH.join(root, files[i]);
            if (file)
                try {
                    this.templates[opts.id || file[0]] = await template.update(path);
                    paths.push(path);
                }
                catch (err) {
                    throw err;
                }
        }
        if (opts.developmentMode)
            this.all('*', (req, res, next) => Promise.all(paths.map(p => {
                return template.update(p);
            })).then(next));
    }
    static(path, root, opts = {}) {
        path = path.replace(/\/$/, '');
        const pL = path.length + 1;
        this.get(path + '/*', (req, res, next) => res.file(PATH.join(root, req.url.path.slice(pL) || 'index.html'), { maxAge: opts.maxAge || 31556952, onError: next }));
    }
    listen(port, host = 'localhost', callback) {
        return this.server.listen(port, host, callback)
            .on('error', (err) => this.emit('error', err))
            .on('close', () => this.emit('close'));
    }
    on(evt, listener) {
        if (!this.listeners[evt])
            this.listeners[evt] = [];
        this.listeners[evt].push(listener);
    }
    emit(evt, ...args) {
        if (this.listeners[evt])
            for (let i = 0, l = this.listeners[evt].length; i < l; i++)
                this.listeners[evt][i](...args);
    }
}
exports.server = server;
//# sourceMappingURL=server.js.map