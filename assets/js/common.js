(function(){
    const isLocal = /^(127|localhost)/.test(location.host);
    self.T = new class{
        action = {};
        async postMessage(data,swc){
            let ctrl = swc||(await navigator.serviceWorker.ready).active;
            return ctrl.postMessage(data)
        }
        async postMethod(method,swc){
            return this.postMessage({method},swc);
        }
        postReg(swc){
            return this.postMethod('register',swc)
        }
        async unregister(){
            (await navigator.serviceWorker.ready).unregister();
        }
        async update(){
            (await navigator.serviceWorker.ready).update();
        }
        showWin(id){
            let elm = document.querySelector(id);
            let mask = elm.parentNode;
            if(mask&&mask.classList.contains('w-mask')){
                return elm.dispatchEvent(new CustomEvent('show')),elm;
            }
            mask = document.body.appendChild(document.createElement('div'));
            mask.classList.add('w-mask');
            mask.appendChild(elm);
            elm.addEventListener('show',function(){
                this.parentNode.hidden = !1;
                document.body.classList.add('hidebar');
            });
            elm.addEventListener('hide',function(){
                this.parentNode.hidden = !0;
                document.body.classList.remove('hidebar');
            });
            mask.addEventListener('click',function(e){
                if(this===e.target){
                    this.hidden = !0;
                    document.body.classList.remove('hidebar');
                }
            });
            document.body.classList.add('hidebar');
            return elm;
        }
        async ReadMessage(event){
            let data = event.data;
            let source = event.source;
            if(isLocal)console.log(data);
            if (data&&data.constructor.name === 'Object') {
                let clientID = data.clientID;
                let method = data.method;
                if(clientID&&this.action[clientID] instanceof Function){
                    await this.action[clientID](data,source);
                }else if(method){
                    if(this.action[method] instanceof Function){
                        await this.action[method](data,source);
                    }else{
                        switch(method){
                            case 'pwa_activate':{
                                let elm = this.showWin('#pwa-register');
                                if(elm){
                                    clearTimeout(T.timer);
                                    T.timer = setTimeout(()=>location.reload(),1000);
                                }
                                break;
                            }
                            case 'notice':{
                                let dialogElm = this.showWin('#pwa-notice');
                                dialogElm.querySelector('.content').innerHTML = data.result||'更新成功';
                                if(data.reload){
                                    clearTimeout(this.timer);
                                    this.timer = setTimeout(
                                        ()=>location.reload(),
                                        2000
                                    );
                                }
                                break;
                            }
                            case 'log':{
                                let dialogElm = this.showWin('#pwa-notice');
                                dialogElm.querySelector('.content').innerHTML = data.result||'更新成功';
                                break;
                            }
                        }
                    }
                }
                clientID = null;
                method = null;
                data = null;
            }
        }
        async addJS(src){
            return new Promise((back,error)=>{
                let script = document.createElement('script');
                script.addEventListener('load',function(){
                    back(this);
                });
                script.addEventListener('error',function(){
                    error(this);
                });
                script.src = src;
                document.body.appendChild(script);
            })
        }
        async FetchData(url,istext,progress){
            let response = await fetch(url).catch(e=>false);
            let responseBuff;
            if(progress instanceof Function){
                const chunks = [];
                const fullsize = parseInt(response.headers.get('content-length')||0);
                //const filetype = response.headers.get('content-type')||'application/octet-stream';
                let chunkSize = 0;
                const reader = response.body.getReader();
                while (true) {
                    const {done,value} = await reader.read();
                    if (done)break;
                    /* 下载进度*/
                    chunks.push(value);
                    chunkSize += value.byteLength;
                    progress(chunkSize,fullsize,value.byteLength);
                }
                return new Uint8Array(await (new Blob(chunks)).arrayBuffer());
            }
            if(response){
                if(istext) return await response.text();
                //return await response.text();
                //if(type=='json')return await response.json();
                //if(type=='blob')return await response.blob();
                //return responseBuff;
                return new Uint8Array(await response.arrayBuffer());
            }
        }
        async ajax(url,istext,progress){
            return new Promise(back=>{
                let request = new XMLHttpRequest;
                request.addEventListener('readystatechange',function(event){
                    if(request.readyState===request.DONE){
                        if(request.response instanceof ArrayBuffer) return back(new Uint8Array(request.response));
                        back(request.response);
                    }
                });
                let speed = 0;
                progress instanceof Function&&request.addEventListener('progress',function(e){
                    if(!speed)speed = e.loaded;
                    else speed = e.loaded - speed;
                    progress(e.loaded, e.total,speed);
                });
                request.responseType = istext?istext=='json'?'json':'text':'arraybuffer';
                request.open('GET',url);
                request.send();
            });
        }
        async toPlay(elm){
            if(elm.disabled)return;
            elm.disabled = !0;
            let src = elm.getAttribute('data-url');
            document.querySelector('.player-video').hidden = !1;
            let video = document.querySelector('video');
            let data = localStorage.getItem('play-jilu')||'[]';
            data = JSON.parse(data)||[];
            if(data&&data instanceof Array){

            }else{
                data = [];
            }
                data = data.filter(v=>v['url']!=location.href);
                data.unshift({url:location.href,title:document.title});
                data = data.slice(0,10);
                localStorage.setItem('play-jilu',JSON.stringify(data));
            if (video.canPlayType('application/vnd.apple.mpegurl')) {
                video.src = src;
                video.addEventListener('canplay', function () {
                video.play();
                });
            }else{
                if (!self.Hls) {
                    await this.addJS('https://cdnjs.cloudflare.com/ajax/libs/hls.js/1.5.4/hls.min.js');
                }
                if(Hls.isSupported()){
                    const hls = new self.Hls();
                    elm.hls = hls;
                    hls.loadSource(src);
                    hls.attachMedia(video);
                    video.play();
                }
            }
        }
        async downloadTS(elm){
            if(elm.disabled)return;
            if(elm.getAttribute('data-downurl')){
                return this.download(elm.getAttribute('data-downurl'),elm.getAttribute('data-name')+'.ts');
            }
            elm.disabled = !0;
            let showinfo = str=>{
                elm.innerHTML=str;
            };
            let url = elm.getAttribute('data-url');
            const list = [];
            if(!self.m3u8parser){
                showinfo('正在下载流程脚本');
                await this.addJS('/assets/js/lib/m3u8-parser.js');
                await this.addJS('/assets/js/lib/aes-decryptor.js');
            }
            showinfo('解析文件中');
            url = this.getPath(url);
            console.log(url);;
            let m3u8Text = await this.ajax(url,!0);
            if(!m3u8Text) return showinfo('解析失败'+m3u8Text);;
            let parser = new m3u8parser(m3u8Text);
            if (!parser.manifest.segments.length) {
                showinfo('解析成功!分析索引');
                if(parser.manifest.playlists&&parser.manifest.playlists.length){                    
                    for(let item of parser.manifest.playlists){
                        //if (item.attributes) Object.assign(ATTR, item.attributes);
                        let m3u8Url = this.getPath(item.uri);
                        let nextParser = new m3u8parser(await this.ajax(m3u8Url, !0));
                        if (nextParser.manifest.segments.length) {
                            list.push(...nextParser.manifest.segments.map(v => {
                                v.uri = this.getPath(v.uri);
                                if (v.key &&typeof v.key.uri ==='string') {
                                    if (v.key.uri.charAt(0) == '/') {
                                        v.key.href = this.getPath(v.key.uri);
                                    }
                                }
                                return v;
                            }));
                        }
        
                    }
                }else if(parser.lineStream&&parser.lineStream.buffer){
                    let m3u8Url = this.getPath(parser.lineStream.buffer);
                    m3u8Url = this.getPath(m3u8Url);
                    let nextParser = new m3u8parser(await this.ajax(m3u8Url, !0));
                    if (nextParser.manifest.segments.length) {
                        list.push(...nextParser.manifest.segments.map(v => {
                            v.uri = this.getPath(v.uri);
                            if (v.key &&typeof v.key.uri ==='string') {
                                if (v.key.uri.charAt(0) == '/') {
                                    v.key.href = this.getPath(v.key.uri);
                                }
                            }
                            return v;
                        }));
                    }

                }
            }else{
                showinfo('解析成功!分析影片序列');
                list.push(...parser.manifest.segments.map(v => {
                    v.uri = this.getPath(v.uri);
                    if (v.key && typeof v.key.uri === 'string') {
                        if (v.key.uri.charAt(0) == '/') {
                            v.key.href = this.getPath(v.key.uri);
                        }
                    }
                    return v;
                }));
            }
            let index = 0;
            let nowbuff;
            let keyData = {};
            let chunks = [];
            showinfo('解析完毕,进行下载');
            for(let frag of list){
                let databuf = await this.ajax(frag.uri,null,(loadsize,fullsize,chunksize)=>{
                    let sd = '当前速率'+(chunksize/1024).toFixed(0)+'KB';
                    let cp = fullsize>0?',当前进度'+(loadsize*100/fullsize).toFixed(2)+'%':'';
                    showinfo('下载中:'+(index+1)+'/'+list.length+sd+cp);
                });
                if(databuf){
                    let buffer;
                    if (frag.key) {
                        if (frag.key.href) {
                            if (!keyData[frag.key.href]) {
                                let buf = await this.ajax(frag.key.href);
                                if(buf){
                                    keyData[frag.key.href] = buf.buffer;
                                }else{
                                    alert(frag.key.href);
                                }
                            }
                            buffer = keyData[frag.key.href];
                        }
                        if (!nowbuff || nowbuff != buffer) {
                            index = 0;
                            nowbuff = buffer;
                        }
                        let aes = new AESDecryptor();
                        aes.constructor();
                        aes.expandKey(buffer);
                        databuf = aes.decrypt(databuf.buffer, 0, new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, index]).buffer, !0);
                        aes.destroy();
                        aes = null;
                    }
                    chunks.push(databuf);
                    index++;
                }
                //showinfo('完成:'+index+'/'+list.length);
            }
            if(!index) return;
            let downurl = URL.createObjectURL(new Blob(chunks,{type:'video/mp2t'}));
            if(elm)elm.setAttribute('data-downurl',downurl);
            this.download(downurl,elm.getAttribute('data-name')+'.ts');
            elm.disabled = !1;
            showinfo('下载完毕');

        }
        download(url,name){
            let a = document.createElement('a');
            a.href = url;
            a.download = name;
            a.click();
            a.remove();
        }
        readPath(url){
            let urlInfo = new URL(url);
            this.urlmap = url.split('/').slice(0,-1).join('/')+'/';
            this.origin = urlInfo.origin;
    
        }
        getPath(str) {
            if (str.indexOf('http') === 0 || str.indexOf('//') === 0) {
                if(str.indexOf('//') === 0)str = 'https:'+str;
                this.readPath(str);
            }else if(str.charAt(0)==='/'){
                str = (this.origin||location.origin)+str; 
            }else if(this.urlmap){
                str = this.urlmap+str; 
            }
            return str;
        }
        async unzip(result,password){
            if(!self.zip){
                await T.addJS('/assets/js/lib/zip.min.js');
            }
            let ReaderList = await new zip.ZipReader(
                new zip.BlobReader(result instanceof Blob?result:new Blob([result]))
            ).getEntries().catch(e=>false);
            if(!ReaderList||!ReaderList.length) return false;
            let contents;
            const getData = (entry)=>{
                let rawPassword;
                if(password){
                    rawPassword = password instanceof Uint8Array?password:new TextEncoder().encode(password);
                }
                return entry.getData(new zip.Uint8ArrayWriter(), {rawPassword:entry.encrypted?rawPassword:undefined}).catch(async e=>{
                    let msg = e.message;
                    if(password===false)return;
                    if(msg == zip.ERR_INVALID_PASSWORD||msg==zip.ERR_ENCRYPTED){
                        password = window.prompt(password instanceof Uint8Array ? new TextDecoder('gbk').decode(password):password);
                        if(password){
                            return await getData(entry);
                        }else{
                            password = false;
                        }
                    }
                });
            }
            if(ReaderList){
                for await(let entry of ReaderList){
                    if(entry.directory)continue;
                    let data = await getData(entry);
                    if(data){
                        if(!contents)contents={};
                        contents[entry.filename] = data;
                    }
                }
            }
            password = null;
            result = null;
            ReaderList = null;
            return contents||false;
        }
        async upload(fn,mime){
            let T = this;
            let upload = document.createElement('input');
            upload.type = 'file';
            upload.addEventListener('change',function(){
                if(fn instanceof Function){
                    Array.from(this.files,fn);
                }
                this.remove();
            },{once:!0});
            if(mime){
                upload.accept = mime;
            }
            upload.click();
        }
        async toClear(result){
            return this.postMessage({method:'clear',result});
        }
        password = 'IAM18';
        async toUpload(type,isadd,mime){
            this.upload(async file=>{                
                switch(type){
                    case 'json':{
                        let result = JSON.parse(await file.text());
                        this.postMessage({
                            method:'add-json',
                            result,
                            isadd
                        });
                        break;
                    }
                    case 'zip':{
                        this.postMessage({
                            method:'add-zip',
                            result:await T.unzip(file,this.password),
                            isadd
                        });
                        break;
                    }
                    case 'import':{
                        if(await file.slice(0,2).text() == 'PK'){
                            let data = await this.unzip(file,this.password);
                            if(data){
                                for(let key in data){
                                    if(/\.dat$/.test(key)){
                                        file = new Blob([data[key]]);
                                        break;
                                    }
                                }
                            }
                        }
                        let response = new Response(file,{
                            headers:{
                                'content-lengh':file.size
                            }
                        });
                        let CACHE_NAME = await this.getResult('cachename');
                        let sqlname = await this.getResult('sqlname');
                        let cache = await caches.open(CACHE_NAME);
                        await cache.put(sqlname,response);
                        let dialogElm = this.showWin('#pwa-notice');
                        dialogElm.querySelector('.content').innerHTML = '导入成功';
                        clearTimeout(this.timer);
                        this.timer = setTimeout(
                            ()=>location.reload(),
                            1000
                        );
                        break;
                    }
                }
            },mime);
        }
        async toDelete(id,elm){
            if(elm)elm.remove();
            return T.postMessage({method:'delete-data',result:id});
        }
        async toExportId(id){
            let data = await this.getResult('get-data',id);
            console.log(data);
            if(data&&data.constructor === Array){
                let url;
                let name = document.title+'.json';
                if(data.length==1){
                    url = URL.createObjectURL(new Blob([data[0][1]],{type:'text/json'}));
                }else if(data.length>1){
                    if(!self.zip){
                        await T.addJS('/assets/js/lib/zip.min.js');
                    }
                    const zipFileWriter = new zip.BlobWriter();
                    const zipWriter = new zip.ZipWriter(zipFileWriter);
                    for(let items of data){
                        await zipWriter.add(
                            items[0],
                            new zip.BlobReader(
                                items[1] instanceof Blob?items[1]:new Blob([items[1]],{type:'application/json'})
                            )
                        );

                    }
                    await zipWriter.close();
                    url = URL.createObjectURL(new Blob([await zipFileWriter.getData()],{type:'application/x-zip-compressed'}));
                    name = document.title+'.zip';

                }
                if(url)this.download(url,name);
            }
        }
        constructor(){
            document.addEventListener('readystatechange',function(){
                if(document.readyState=='complete'){
                    let elm = document.querySelector('#btn-update-cache');
                    elm&&elm.addEventListener('click',function(){
                        T.showWin('#admin-act')
                    });
                    document.addEventListener('gesturestart',function(e){
                        e.preventDefault();
                    });
                    let data = localStorage.getItem('play-jilu');
                    if(data){
                        data = JSON.parse(data)||[];
                        if(!data.length) data = [];
                        let html ='<ul>';
                        for(let items of data){
                            html += `<li><a href="${items['url']}">${items['title']}</a></li>`;
                        }
                        html += '</ul>';
                        let elm = document.querySelector('#play-jilu');
                        if(elm)elm.innerHTML = html;
                    }else{   
                        fetch('/assets/template-play.html');
                        fetch('/assets/template-home.html');
                        localStorage.setItem('play-jilu','[]');
                    }

                }
            });
        }
        getResult(method,result){
            return new Promise(back=>{
                let clientID = Date.now()+''+Math.random();
                this.action[clientID] = function(data){
                    back(data.result);
                    delete self.T.action[data.clientID];
                }
                this.postMessage({
                    method,
                    clientID,
                    result
                });
            });
        }
        async export(){
            let CACHE_NAME = await this.getResult('cachename');
            let sqlname = await this.getResult('sqlname');
            let cache = await caches.open(CACHE_NAME);
            let response = await cache.match(sqlname);
            if(response){
                let url = URL.createObjectURL(await response.blob());
                this.download(url,sqlname.split('/').pop());
            }else{
                let dialogElm = this.showWin('#pwa-notice');
                dialogElm.querySelector('.content').innerHTML = '没找到数据';
            }
        }
        async testZip(elm){
            elm.remove();
            this.postMessage({
                method:'add-zip',
                result:await this.unzip(await T.ajax('/assets/test.zip')),
                isadd:!1
            });
        }
    }
    let sw = navigator.serviceWorker;
    if(!sw){
        return alert('你当前访问协议不支持ServiceWorker,需要HTTPS访问!');
    }
    sw.addEventListener('message',event=>self.T.ReadMessage(event));
    sw.addEventListener('onmessageerror',async event=>{
        alert(event);
        let act = await this.ready;
        act.update();
    });
    sw.addEventListener('controllerchange', e =>self.T.postReg(e.active));
    sw.register('/sw-video.js').then(async reg=>{
        console.log(reg.installing?'register':'active');
        if(reg.installing){
            self.T.postReg(reg.installing);
        }
        (reg.active||reg.installing).addEventListener('statechange', e => {
            if(['redundant', 'activated'].includes(e.target.state)){
                self.T.postReg(e.target);
            }
        });
    });
})();