class NengeCommon{
    constructor(){
        const T = this;
        document.addEventListener('readystatechange',()=>{
            if(document.readyState=='complete'){
                let elm = document.querySelector('#btn-update-cache');
                elm&&elm.addEventListener('click',function(){
                    T.showWin('#admin-act')
                });
                return ;
                document.addEventListener('gesturestart',function(e){
                    e.preventDefault();
                });
                Array.from(document.querySelectorAll('.sql-item-list a'),elm=>{
                    elm.addEventListener('click',e=>{
                        e.preventDefault();
                        e.stopPropagation();
                        let xhr = new XMLHttpRequest();
                        xhr.addEventListener('progress',e=>{
                            elm.innerHTML = (e.loaded*100/e.total).toFixed(0)+'%';
                        });
                        xhr.addEventListener('load',e=>{
                            this.download(decodeURI(elm.getAttribute('data-name'))+'.zip',URL.createObjectURL(xhr.response));
                        });
                        xhr.open('GET',elm.href);
                        xhr.responseType = 'blob';
                        xhr.send();
                    })
                });

            }
        });
        navigator.serviceWorker.addEventListener('error',e=>console.log(e));
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
    async opensw(elm){
        elm&&elm.remove();
        let sw = await navigator.serviceWorker.register('/sw-rooms.js');
        let sw2 = await navigator.serviceWorker.ready;
        sw2.update();
        navigator.serviceWorker.addEventListener('message',e=>{
            if(e.data=='ok') location.reload();
        },{once:true});
        sw2.active.postMessage('install');
       

    }
    async export(){
        let sw = await navigator.serviceWorker.ready;
        navigator.serviceWorker.addEventListener('message',e=>{
            this.download('data.sqlite3',URL.createObjectURL(e.data.file));
        },{once:true});
        sw.active.postMessage('export');
        document.querySelector('#admin-act').dispatchEvent(new CustomEvent('hide',{}));

    }
    download(name,url){
        let a = document.createElement('a');
        a.download = name;
        a.href = url;
        a.click();
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
    async importJSON(elm){
        this.upload(async file=>{
            elm.remove();
            let text = await file.text();
            let sw = await navigator.serviceWorker.ready;
            navigator.serviceWorker.addEventListener('message',e=>{
                console.log(e);
                if(e.data=='reload')location.reload();
            },{once:true});
            sw.active.postMessage(JSON.parse(text));
            document.querySelector('#admin-act').dispatchEvent(new CustomEvent('hide',{}));

        },'*.json');
    }
    async importFile(elm){
        this.upload(async file=>{
            elm.remove();
            let sw = await navigator.serviceWorker.ready;
            navigator.serviceWorker.addEventListener('message',e=>{
                console.log(e);
                if(e.data=='reload')location.reload();
            },{once:true});
            sw.active.postMessage(file);
        },'*.sqlite3');
    }
}
var N = new NengeCommon();