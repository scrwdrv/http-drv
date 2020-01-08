"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const http = require("http");
const cheerio = require("cheerio");
const regex = require("simple-regex-toolkit");
const PATH = require("path");
const query_string_1 = require("query-string");
const mime = require("mime-types");
class HTTPServer {
    constructor() {
        this.routes = {};
        this.routesLength = {};
        this.hits = {};
        this.templates = {};
        const methods = ['ALL', 'GET', 'HEAD', 'POST', 'PUT', 'DELETE', 'CONNECT', 'OPTIONS', 'TRACE', 'PATCH'];
        for (let method of methods) {
            if (method !== 'ALL') {
                this.routes[method] = [];
                this.routesLength[method] = 0;
            }
            this[method.toLowerCase()] = (path, handler, secondHandler) => {
                let route = {
                    match: undefined,
                    handler: handler,
                    secondHandler: secondHandler
                };
                if (typeof path === 'string') {
                    if (path === '*')
                        route.match = null;
                    else if (path[path.length - 1] === '*') {
                        path = path.slice(0, -1);
                        route.match = (p) => {
                            return p.indexOf(path) === 0 ? true : false;
                        };
                    }
                    else {
                        const params = path.match(/(?<=\/:)\w+\?*/g);
                        if (params) {
                            let regStr = '';
                            path.split(/\/:\w+\?*/).forEach((item, i) => {
                                let param = '';
                                if (params[i])
                                    if (/\?$/.test(params[i]))
                                        param = '(?:\\/((?:(?!\\/).)+))*', params[i] = params[i].slice(0, -1);
                                    else
                                        param = '\\/((?:(?!\\/).)+)';
                                regStr += regex.escape(item) + param;
                            });
                            const reg = regex.from('/' + regStr + '/'), paramsLength = params.length;
                            route.match = (p, reqParams) => {
                                const match = reg.exec(p);
                                if (!match)
                                    return false;
                                for (let i = 0; i < paramsLength; i++)
                                    reqParams[params[i]] = match[i + 1];
                                return true;
                            };
                        }
                        else
                            route.match = (p) => {
                                return p === path ? true : false;
                            };
                    }
                }
                else
                    route.match = (p) => {
                        return path.test(p);
                    };
                if (method !== 'ALL') {
                    this.routes[method].push(route);
                    this.routesLength[method]++;
                }
                else
                    for (let method of methods)
                        if (method !== 'ALL') {
                            this.routes[method].push(route);
                            this.routesLength[method]++;
                        }
            };
        }
        this.server = http.createServer((req, res) => {
            let ip = 'unknown';
            if (req.headers['x-forwarded-for'])
                if (typeof req.headers['x-forwarded-for'] === 'string')
                    ip = req.headers['x-forwarded-for'].split(',')[0].trim();
                else
                    ip = req.headers['x-forwarded-for'][0];
            else
                ip = req.connection.remoteAddress;
            this.hits[ip] ? this.hits[ip]++ : this.hits[ip] = 1;
            res.setHeader('X-Frame-Options', 'sameorigin');
            res.setHeader('X-XSS-Protection', '1; mode=block');
            res.setHeader('X-Download-Options', 'noopen');
            res.setHeader('X-Content-Type-Options', 'nosniff');
            res.setHeader('X-DNS-Prefetch-Control', 'off');
            res.setHeader('Strict-Transport-Security', 'max-age=31556952; includeSubDomains');
            try {
                req.url = decodeURIComponent(req.url);
            }
            catch (err) { }
            const url = urlParser(req.url), pathLength = url.path.length, routesFinder = (body) => {
                let request = {
                    method: req.method,
                    url: url,
                    params: {},
                    body: body,
                    ip: ip,
                    cookie: getCookies(req.headers.cookie),
                    langs: getAcceptLangs(req.headers["accept-language"])
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
                    render: (json, templateId, dynamic, code = 200) => {
                        dynamic ? response.json(this.templates[templateId].renderer.dynamic(json), code) :
                            response.send(this.templates[templateId].renderer.static(json), code);
                    },
                    cookie: (name, value, maxAge = 31556952) => {
                        res.setHeader('Set-Cookie', `${name}=${value}; max-age=${maxAge}; path="/"; HttpOnly; Secure`);
                    },
                    file: (path, maxAge, onError) => {
                        fs.stat(path, (err, stats) => {
                            if (err)
                                return onError ? onError(err) : res.writeHead(404).end();
                            if (req.headers.range) {
                                let range = req.headers.range.slice(req.headers.range.indexOf('=') + 1).split("-");
                                range = [parseInt(range[0]), range[1] ? parseInt(range[1]) : stats.size - 1];
                                res.writeHead(206, {
                                    'Content-Range': `bytes ${range[0]}-${range[1]}/${stats.size}`,
                                    'Accept-Ranges': 'bytes',
                                    'Content-Length': range[1] - range[0] + 1,
                                    'Content-Type': mime.contentType(PATH.extname(path)) || 'text/html; charset=UTF-8',
                                    'Cache-Control': maxAge ? `max-age=${maxAge}` : 'no-cache'
                                });
                                const stream = fs.createReadStream(path, { start: range[0], end: range[1] });
                                if (onError)
                                    stream.on('error', onError);
                                stream.pipe(res);
                            }
                            else {
                                res.writeHead(200, {
                                    'Content-Length': stats.size,
                                    'Content-Type': mime.contentType(PATH.extname(path)) || 'text/html; charset=UTF-8',
                                    'Cache-Control': maxAge ? `max-age=${maxAge}` : 'no-cache'
                                });
                                const stream = fs.createReadStream(path);
                                if (onError)
                                    stream.on('error', onError);
                                stream.pipe(res);
                            }
                        });
                    }
                };
                const findRoute = (index = 0) => {
                    for (let i = index; i < this.routesLength[req.method]; i++)
                        if (this.routes[req.method][i].match === null || this.routes[req.method][i].match(url.path, request.params))
                            return this.routes[req.method][i].handler(request, response, this.routes[req.method][i].secondHandler ? () => this.routes[req.method][i].secondHandler(request, response, () => findRoute(i + 1)) : () => findRoute(i + 1));
                };
                findRoute();
            };
            if (pathLength > 1 && url.path[pathLength - 1] === '/') {
                res.writeHead(301, { 'Location': url.path.slice(0, -1) + url.search });
                res.end();
            }
            else if (req.method === 'POST') {
                const contentType = req.headers['content-type'].toLocaleLowerCase();
                if (contentType.indexOf('application/json') > -1) {
                    let jsonString = '';
                    req.on('data', chunk => jsonString += chunk).on('end', () => {
                        try {
                            routesFinder(JSON.parse(jsonString));
                        }
                        catch (err) {
                            routesFinder({});
                        }
                    }).setEncoding('utf8');
                }
                else if (contentType.indexOf('application/x-www-form-urlencoded') > -1) {
                    let queryString = '';
                    req.on('data', chunk => queryString += chunk).on('end', () => routesFinder(query_string_1.parse(queryString))).setEncoding('utf8');
                }
                else
                    routesFinder({});
            }
            else
                routesFinder();
        });
    }
    static(path, root, maxAge) {
        const url = path.replace(/\/$/, ''), pL = url.length + 1;
        this.get(url.length ? url + '/*' : '*', (req, res, next) => res.file(PATH.join(root, req.url.path.slice(pL) || 'index.html'), maxAge === undefined ? 31556952 : maxAge, next));
    }
    render(json, templateId, dynamic) {
        if (dynamic)
            return this.templates[templateId].renderer.dynamic(json);
        else
            return this.templates[templateId].renderer.static(json);
    }
    updateTemplate(id) {
        return new Promise((resolve, reject) => fs.readFile(this.templates[id].path, 'utf8', (err, data) => {
            if (err)
                return reject(err);
            const $ = cheerio.load(data, { decodeEntities: false });
            let r = {
                dynamic: {
                    string: 'let r = {title:``,head:[],body:[],attr:[],exec:[]};',
                    functions: '',
                    functionId: 0
                },
                static: null
            }, staticFunctions = '';
            $('script[static]').each((i, e) => {
                const elem = $(e);
                staticFunctions += compileString(trim(elem.html())) + ';';
                elem.remove();
            });
            $('[render]').each((i, e) => {
                const elem = $(e), attrs = elem.attr(), renderType = attrs.render;
                elem.removeAttr('render');
                switch (renderType) {
                    case 'title':
                        r.dynamic.string += `r.title = ${flattenVariables(elem.text())};`;
                        break;
                    case 'head':
                        r.dynamic.string += `r.head.push({tag:${quote(e.tagName)},attrs:[${getAttrs().others}]});`;
                        break;
                    case 'body':
                        const body = getBody(elem.html(), elem.find('script[template]')), bodyAttrs = getAttrs();
                        r.dynamic.string += `r.body.push({id:${quote(bodyAttrs.id)},name:${bodyAttrs.name ? quote(bodyAttrs.name) : 'null'},content:${body.html},attrs:[${bodyAttrs.others}]});`;
                        r.dynamic.functions += body.functions;
                        break;
                    case 'attr':
                        const attrAttrs = getAttrs();
                        r.dynamic.string += `r.attr.push({id:${quote(attrAttrs.id)},attrs:[${attrAttrs.others}]});`;
                        break;
                    case 'exec':
                        r.dynamic.string += `r.exec.push(${flattenVariables(trim(elem.html()))});`;
                        break;
                    default:
                        throw new Error(`unknown render type [${renderType}]`);
                }
                function getAttrs() {
                    let arrStrings = [], id, name;
                    for (let attr in attrs) {
                        if (attr === 'id')
                            id = attrs[attr];
                        else if (attr === 'name')
                            name = attrs[attr];
                        else
                            arrStrings.push(`{attr:${quote(attr)},val:${flattenVariables(attrs[attr])}}`);
                    }
                    return {
                        others: arrStrings.join(','),
                        id: id,
                        name: name
                    };
                }
            });
            r.static = getBody($.html(), $('script[template]'));
            Object.assign(this.templates[id], {
                renderer: {
                    dynamic: new Function('json', r.dynamic.string + 'return r;' + r.dynamic.functions + staticFunctions),
                    static: new Function('json', 'return ' + r.static.html + ';' + r.static.functions + staticFunctions)
                }
            });
            resolve();
            function getBody(html, elems) {
                let fId = 0, functions = '';
                elems.each((i, script) => {
                    let outerScript = $.html(script), scriptHTML = trim($(script).html());
                    html = html.replace(outerScript, '\${' + `f${fId}()` + '}');
                    functions += compileString(`function f${fId}(){let template = '';${scriptHTML[scriptHTML.length - 1] === ';' ?
                        scriptHTML : scriptHTML + ';'}return template;};`);
                    fId++;
                });
                return {
                    html: flattenVariables(trim(html)),
                    functions: functions
                };
            }
            function trim(str) {
                return str.trim().replace(/[\n\r]/g, '').replace(/\s{2,}/g, ' ').replace(/([>;])\s+/g, '$1');
            }
            function flattenVariables(str) {
                const variables = str.match(/\$\$((?!\$)\S)+\$\$/g);
                let result = str;
                if (variables)
                    for (let i = 0, l = variables.length; i < l; i++) {
                        const index = str.indexOf(variables[i]);
                        result = result.replace(variables[i], '\${' + str.slice(index + 2, index + variables[i].length - 2) + '}');
                    }
                return compileString(quote(result));
            }
            function quote(str) {
                return '`' + str + '`';
            }
            function compileString(str) {
                const stringTemplates = str.match(/\${((?![{}]).)+}/g);
                if (stringTemplates) {
                    for (let i = 0, l = stringTemplates.length; i < l; i++)
                        str = str.replace(stringTemplates[i], '`+(' + stringTemplates[i].slice(2, -1) + ')+`');
                    return compileString(str);
                }
                else
                    return str.trim().replace(/(?:``\+)|(?:\+``)/g, '');
            }
        }));
    }
    template(directory, developmentMode = false) {
        const files = fs.readdirSync(directory);
        for (let i = files.length; i--;) {
            const file = /.+(?=\.template$)/.exec(files[i]), path = PATH.join(directory, files[i]);
            if (file) {
                this.templates[file[0]] = { path: path };
                this.updateTemplate(file[0]);
            }
        }
        if (developmentMode)
            this.all('*', (req, res, next) => {
                let promises = [];
                for (let template in this.templates)
                    promises.push(this.updateTemplate(template));
                Promise.all(promises).then(next);
            });
    }
    getHits() {
        const hits = this.hits;
        this.hits = {};
        return hits;
    }
    listen(port, host = 'localhost', callback) {
        return this.server.listen(port, host, callback).on('error', (err) => {
            console.log(err);
        });
    }
}
exports.HTTPServer = HTTPServer;
function getCookies(cookies) {
    if (!cookies)
        return {};
    let cA = cookies.split(';'), c = {};
    for (let i = cA.length; i--;) {
        cA[i] = cA[i].trim();
        let cI = cA[i].indexOf('=');
        c[cA[i].slice(0, cI)] = cA[i].slice(cI + 1);
    }
    return c;
}
function getAcceptLangs(acceptLangs) {
    if (!acceptLangs)
        return [];
    const pairs = acceptLangs.split(',');
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
function urlParser(str) {
    let url = {
        query: {},
        path: str,
        search: ''
    };
    const queryIndex = str.indexOf('?');
    if (queryIndex > -1) {
        url.path = str.slice(0, queryIndex);
        url.search = str.slice(queryIndex);
        const queries = str.slice(queryIndex + 1).split('&');
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
