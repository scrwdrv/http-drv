import * as cheerio from 'cheerio';
import * as fs from 'fs';

export interface Renderer {
    dynamic: (data: object) => object;
    static: (data: object) => string;
}

export function update(path: string) {
    return new Promise<Renderer>((resolve, reject) =>
        fs.readFile(path, 'utf8', (err, data) => {
            if (err) return reject(err);

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
                const elem = $(e),
                    attrs = elem.attr(),
                    renderType = attrs.render;

                elem.removeAttr('render');

                switch (renderType) {
                    case 'title':
                        r.dynamic.string += `r.title = ${flattenVariables(elem.text())};`;
                        break;
                    case 'head':
                        r.dynamic.string += `r.head.push({tag:${quote(e.tagName)},attrs:[${getAttrs().others}]});`;
                        break;
                    case 'body':
                        const body = getBody(elem.html(), elem.find('script[template]')),
                            bodyAttrs = getAttrs();
                        r.dynamic.string += `r.body.push({id:${quote(bodyAttrs.id)},name:${bodyAttrs.name ? quote(bodyAttrs.name) : 'null'},content:${body.html},attrs:[${bodyAttrs.others}]});`;
                        r.dynamic.functions += body.functions;
                        break;
                    case 'attr':
                        const attrAttrs = getAttrs();
                        r.dynamic.string += `r.attr.push({id:${quote(attrAttrs.id)},attrs:[${attrAttrs.others}]});`;
                        break
                    case 'exec':
                        r.dynamic.string += `r.exec.push(${flattenVariables(trim(elem.html()))});`;
                        break;
                    default:
                        throw new Error(`unknown render type [${renderType}]`);
                }

                function getAttrs() {
                    let arrStrings = [], id: string, name: string;
                    for (let attr in attrs) {
                        if (attr === 'id') id = attrs[attr];
                        else if (attr === 'name') name = attrs[attr];
                        else arrStrings.push(`{attr:${quote(attr)},val:${flattenVariables(attrs[attr])}}`);
                    }
                    return {
                        others: arrStrings.join(','),
                        id: id,
                        name: name
                    };
                }
            });

            r.static = getBody($.html(), $('script[template]'));

            resolve({
                dynamic: new Function('data', r.dynamic.string + 'return r;' + r.dynamic.functions + staticFunctions) as any,
                static: new Function('data', 'return ' + r.static.html + ';' + r.static.functions + staticFunctions) as any
            });

            function getBody(html: string, elems: Cheerio) {
                let fId = 0, functions = '';
                elems.each((i, script) => {
                    let outerScript = $.html(script),
                        scriptHTML = trim($(script).html());
                    html = html.replace(outerScript, '\${' + `f${fId}()` + '}');
                    functions += compileString(`function f${fId}(){let template = '';${scriptHTML[scriptHTML.length - 1] === ';' ?
                        scriptHTML : scriptHTML + ';'}return template;};`);
                    fId++;
                });
                return {
                    html: flattenVariables(trim(html)),
                    functions: functions
                }
            }

            function trim(str: string) {
                return str.trim().replace(/[\n\r]/g, '').replace(/\s{2,}/g, ' ').replace(/([>;])\s+/g, '$1');
            }

            function flattenVariables(str: string) {
                const variables = str.match(/\$\$((?!\$)\S)+\$\$/g);
                let result = str;
                if (variables) for (let i = 0, l = variables.length; i < l; i++) {
                    const index = str.indexOf(variables[i]);
                    result = result.replace(variables[i], '\${' + str.slice(index + 2, index + variables[i].length - 2) + '}');
                }
                return compileString(quote(result));
            }

            function quote(str: string) {
                return '`' + str + '`';
            }

            function compileString(str: string) {
                const stringTemplates = str.match(/\${((?![{}]).)+}/g);
                if (stringTemplates) {
                    for (let i = 0, l = stringTemplates.length; i < l; i++)
                        str = str.replace(stringTemplates[i], '`+(' + stringTemplates[i].slice(2, -1) + ')+`');
                    return compileString(str);
                } else return str.trim().replace(/(?:``\+)|(?:\+``)/g, '');
            }
        })
    );
}