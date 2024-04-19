/**
 * @author Nenge<m@nenge.net>
 * @copyright Nenge.net
 * @license GPL
 * @link https://nenge.net
 * 本功能构建一个虚拟响应服务,利用SQLite作为驱动进行交互
 */
"use strict";
const version = Date.parse('Fri Mar 03 2024 21:00:08 GMT+0800 (中国标准时间)');
class mySQLite{
    isLocal = /(127\.0\.0\.1|localhost)/.test(location.origin);
    cachename = 'sqlite-data';
    sqlfile = '/assets/data.sqlite3';
    tablefield = {
        data:{
            gameID:'int primary key',
            title:'char',
            type:'char',
            region:'char',
            binary:'char',
            language:'char',
            genre:'char',
            titleScreenImage:'char',
        },
        tag:{
            name:'char',
            num:'int'
        }
    }
    constructor(){
        this.jsfile = this.isLocal?'/assets/js/lib/sql.min.js':'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.2/sql-wasm.js';
        this.wasmfile = this.isLocal?'/assets/js/lib/sql.wasm':'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.2/sql-wasm.wasm';
        if(typeof importScripts == undefined&&typeof self.document!=undefined){
            this.ready = new Promise(async back=>{
                let elm = document.body.appendChild(document.createElement('src'));
                elm.addEventListener('load',async e=>{
                    await this.onRuntimeInitialized();
                    back(true);
                })
            })
        }else{
            importScripts(this.isLocal?'/assets/js/lib/ejs.min.js':'https://unpkg.com/ejs@3.1.9/ejs.min.js');
            importScripts(this.jsfile);
            this.ready = new Promise(async back=>{
                await this.onRuntimeInitialized();
                back(true);
            });
        }
    }
    async getResponse(url){
        let cache = await caches.open(this.cachename);
        let response = await cache.match(url);
        if(!response){
            response = await fetch(url).catch(e=>undefined);
            if(response){
                cache.put(url,response);
            }
        }
        return response;
    }
    async onRuntimeInitialized(){
        let response = await this.getResponse(this.wasmfile);
        initSqlJs({
            wasmBinary:new Uint8Array(await response.arrayBuffer())
        });
        this.SQL = await initSqlJsPromise;
        delete this.SQL.wasmBinary;
        Object.assign(this.SQL.Database.prototype,{
            fetchArray(sql,params){
                let result = this.exec(sql,params);
                if(result[0]){
                    let data = [];
                    for(let value of result[0].values){
                        data.push(Object.fromEntries(value.map((v,k)=>[result[0].columns[k],v])))
                    }
                    return data;
                }
            },
            fetchFirst(sql,params){
                let result = this.fetchArray(sql,params);
                if(result&&result[0]){
                    return result[0];
                }
            },
            fetchColumns(index,sql,params){
                let result = Object.values(this.fetchFirst(sql,params)||[]);
                if(result.length){
                    return result[index||0];
                }
            },
            fetchResult(sql,params){
                return this.fetchColumns(0,sql,params);
            }
        });
    }
    async open(){
        await this.ready;
        let cache = await caches.open(this.cachename);
        let response = await cache.match(this.sqlfile).catch(e=>undefined);
        if(response&&response.status){
            response = new Uint8Array(await response.arrayBuffer());
        }
        this.db = response? new this.SQL.Database(response):new this.SQL.Database();
        if(!response||!response.byteLength){
            await this.creatTable();
            await this.save(cache)
        }
        return cache;
    }
    async export(){
        let cache = await caches.open(this.cachename);
        let response = await cache.match(this.sqlfile);
        return await response.blob();
    }
    async save(cache){
        if(!cache) cache = await caches.open(this.cachename);
        let blob = new Blob([this.db.export()],{type:'application/x-sqlite3'});
        await cache.put(this.sqlfile,new Response(blob,{headers:{'content-length':blob.size}}));
    }
    async saveFile(blob){
        let cache = await caches.open(this.cachename);
        await cache.put(this.sqlfile,new Response(blob,{headers:{'content-length':blob.size}}));
    }
    async install(data){
        let cache = await this.open();
        for(let item of data){
            let id = this.db.fetchResult('SELECT `gameID` FROM `data` WHERE `gameID` = ? ;',[item['gameID']]);
            if(id){
                this.db.run('DELETE FROM `data` WHERE `gameID` = ? ;',[item['gameID']]);
            }
            this.db.run('INSERT INTO `data` ('+Array.from(Object.keys(item),e=>'`'+e+'`').join(',')+') VALUES ('+Object.keys(item).fill('?').join(',')+');',Object.values(item));
            if(item['type']){
                let num = this.db.fetchResult('SELECT `num` FROM `tag` WHERE `name` = ?',[item['type']]);
                if(!num){
                    this.db.run('INSERT INTO `tag` (`name`,`num`) VALUES (?,?);',[item['type'],1]);
                }else{
                    this.db.run('UPDATE `tag` SET `num` = ?  WHERE `name` = ? ;',[parseInt(num)+1,item['type']]);
                }
            }
        }
        await this.save(cache);
    }
    async creatTable(){
        Array.from(Object.entries(this.tablefield),entry=>{
            let keys = Array.from(Object.entries(entry[1]),sub=>{
                return '`'+sub[0]+'` '+sub[1];
            }).join(',');
            console.log(`CREATE TABLE \`${entry[0]}\` (${keys});`);
            this.db.run(`CREATE TABLE \`${entry[0]}\` (${keys});`);
        });
    }
    async fetchAll(params){
        await this.open();
        let resultData = {navtags:[]};
        if(this.db){
            let sqlarr = [];
            let sqlstr = [];
            let ordertext = '`title` DESC';
            let tag = params.get('tag')||'';
            let search = params.get('search')||'';
            let order = params.get('order');
            let page = params.get('page');
            let limit = params.get('limit');
            if(!limit)limit = 30;
            limit = parseInt(limit);
            if(!page)page = 1;
            page = parseInt(page);
            if(tag){
                sqlstr.push('`type` = ?');
                sqlarr.push(tag);
            }
            if(search){
                sqlstr.push('`title` LIKE ?');
                sqlarr.push('%'+search+'%');
            }
            if(order){
                ordertext = order=='asc'?' `title` asc':' `title` desc ';
            }
            sqlstr = sqlstr.length>0?' WHERE '+sqlstr.join(' AND '):'';
            let tags = this.db.fetchArray('SELECT * FROM `tag` ORDER BY `num` desc');
            Array.from(tags||[],entry=>{
                resultData.navtags.push([entry['name'],entry['num']]);
            });
            let total = this.db.fetchResult('SELECT count(*) FROM `data` '+sqlstr,sqlarr);
            if(total>0){
                let maxpage = Math.floor(total/limit);
                if(page>maxpage)page = maxpage;
                Object.assign(resultData,{
                    list:[],
                    page,
                    maxpage,
                    maxnum:total,
                    limit,
                });
                let limitext = ((page-1)*limit)+','+limit;
                let data = this.db.fetchArray('SELECT * FROM `data` '+sqlstr+' ORDER BY '+ordertext+' LIMIT '+limitext,sqlarr);
                for(let items of data){
                    let newitem = {
                        id:items['gameID'],
                        type:items['type'],
                        name:items['title'],
                        img:items['titleScreenImage']?'https://images.zaixianwan.app/'+items['titleScreenImage']:'/assets/img/zan.jpg',
                        url:'https://binary.zaixianwan.app/'+items['binary'],
                        language:items['language'],
                        region:items['region']
                    }
                    resultData.list.push(newitem);
                }
                let maxlengh = 8;
                let leftnavs = [];
                let rightnavs = [];
                for(let i=0;i<=8;i++){
                    if(i==0||page+i<maxpage){
                        if(page+i==maxpage||page+i==1){
                            continue;
                        }
                        let num = page+i;
                        rightnavs.push(num);
                        maxlengh--;
                    }
                    if (maxlengh < 0) break;
                    if(i>0&&page-i>1){
                        let num = page-i;
                        leftnavs.unshift(num);
                        maxlengh--;
                    }
                    if (maxlengh < 0) break;
                }
                leftnavs.unshift(1);
                rightnavs.push(maxpage);
                resultData.navpage = leftnavs.concat(rightnavs);
            }
        }
        this.close();
        return resultData;
    }
    close(){
        this.db&&this.db.close();
        this.SQL._sqlite3_free();
        this.SQL._free();
        delete this.db;
    }
    async ReadFile(request){
        let cache = await caches.open('rooms-cdn');
        let response = await cache.match(request);
        if(!response){
            response = await fetch(request);
            if(response){
                cache.put(request,response.clone());
            }
        }
        return response;
    }
    async ReadPage(url,request){
        if(url.indexOf('assets/')!==-1||(url.indexOf('?')===-1)&&url!=='/'){
            return await this.getResponse(request);
        }
        let search = url.split('?');
        let params = new URLSearchParams(search&&search[1]?search[1]:undefined);
        let kk = await this.fetchAll(params);
        let templates = {
            title:'首页',
            search:params.get('search')||'',
            tagname:params.get('tag')||'',
            baseurl:'?search='+(params.get('search')||'')+'&tag='+(params.get('tag')||'')+'&page=',
            list:[],
            topnav:[],
            navpage:[],
            navtags:[],
            maxnum:0,
            maxpage:0,
            error:'请到[缓存管理]导入数据!',
        }
        if(kk&&kk.constructor===Object)Object.assign(templates,kk);
        console.log(kk);
        let response = await(await this.getResponse('/assets/template-home.html')).text();
        response =  ejs.compile(response)(templates);
        ejs.clearCache();
        return new Response(new Blob([response],{type:'text/html;charset=utf-8'}));
    }
}
const MySQL = new mySQLite();
Object.entries({
    install(event) {
        console.log('serviceWorker install');
        return self.skipWaiting(); //跳过等待
    },
    activate(event) {
        console.log('serviceWorker activate');
        return self.skipWaiting();
    },
    fetch(event) {
        const request = event.request;
        let url = request.url.replace(location.origin,'');
        if(url.charAt(0)==='/'){
            return event.respondWith(MySQL.ReadPage(url,request));
        }else if(url.indexOf('images.zaixianwan.app')!==-1){
            return event.respondWith(MySQL.ReadFile(request));
        }
        return false;
    },
    async message(event) {
        let data = event.data;
        let source = event.source;
        console.log(data,source);
        if(data instanceof Array){
            await MySQL.install(data).catch(e=>console.log(e));
            source.postMessage('reload');
            return;
        }
        if(data instanceof Blob){
            await MySQL.saveFile(data);
            source.postMessage('reload');
            return;
        }
        if(data == 'export'){
            source.postMessage({file:await MySQL.export()});
        }
        if(data=='install'){
            await MySQL.ready;
            await MySQL.getResponse('/assets/js/rooms.js');
            await MySQL.getResponse('/assets/img/zan.jpg');
            await MySQL.getResponse('/assets/css/style.css');
            await MySQL.getResponse('/assets/template-home.html')
            source.postMessage('ok');
            return;
        }
    },
    error(e){
        console.log(e.message);
    }
}).forEach(
    entry => self.addEventListener(entry[0], entry[1])
);