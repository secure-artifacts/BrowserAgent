let ws = null;
let hbTimer = null;
const clientId = crypto.randomUUID();

const PORTS = [8765,8766,8767,8768,8769];

function humanLikeScroll() {
  if (window.__hsCtrl) {
    window.__hsCtrl.run = false;
    if (window.__hsCtrl.timer) clearTimeout(window.__hsCtrl.timer);
  }

  const rand = (a,b)=>Math.random()*(b-a)+a;

  const ctrl = {
    run:true,
    timer:null,
    stop(){
      this.run=false;
      if(this.timer) clearTimeout(this.timer);
      delete window.__hsCtrl;
    }
  };

  window.__hsCtrl = ctrl;

  function smooth(dy,done){
    const startY=window.scrollY;
    const target=startY+dy;
    const dur=rand(200,1400);
    const t0=performance.now();

    function f(t){
      if(!ctrl.run) return;
      const p=Math.min((t-t0)/dur,1);
      const e=p<0.5?2*p*p:1-Math.pow(-2*p+2,2)/2;
      window.scrollTo(0,startY+(target-startY)*e);
      if(p<1 && ctrl.run){
        requestAnimationFrame(f);
      }else if(ctrl.run){
        done&&done();
      }
    }
    requestAnimationFrame(f);
  }

  function loop(){
    if(!ctrl.run) return;

    const h=document.documentElement.scrollHeight;
    const y=window.scrollY+window.innerHeight;
    const atBottom=y>=h-5;

    let dy=rand(80,800);
    if(Math.random()<0.15) dy*=-1;
    if(atBottom) dy=-rand(300,900);

    smooth(dy,()=>{
      if(!ctrl.run) return;
      const delay=Math.random()<0.2?rand(3000,7000):rand(800,2500);
      ctrl.timer=setTimeout(loop,delay);
    });
  }

  loop();
}

async function openAndGetFBName(){
  const [tab]=await chrome.tabs.query({active:true,currentWindow:true});

  await chrome.tabs.update(tab.id,{
    url:"https://www.facebook.com/",
    active:true
  });

  await new Promise(res=>{
    function l(id,info){
      if(id===tab.id && info.status==="complete"){
        chrome.tabs.onUpdated.removeListener(l);
        res();
      }
    }
    chrome.tabs.onUpdated.addListener(l);
  });

  await new Promise(r=>setTimeout(r,3000));

  const r=await chrome.scripting.executeScript({
    target:{tabId:tab.id},
    func:()=>{
      const a=document.querySelector('a[aria-label][href*="facebook.com"]');
      if(a){
        const l=a.getAttribute("aria-label");
        if(l){
          return l.split("'s")[0]
                  .split("的")[0]
                  .split("の")[0]
                  .split("님의")[0]
                  .trim();
        }
      }

      const m=document.querySelector('meta[property="og:title"]');
      if(m?.content){
        return m.content.replace(/\s*\|\s*Facebook.*/i,"").trim();
      }

      const h1=document.querySelector("h1");
      if(h1) return h1.innerText.trim();

      return null;
    }
  });

  return r?.[0]?.result || null;
}

function connect(i=0){
  if(ws){
    try{ws.close()}catch{}
    ws=null;
  }

  if(i>=PORTS.length){
    setTimeout(()=>connect(0),5000);
    return;
  }

  try{
    ws=new WebSocket(`ws://127.0.0.1:${PORTS[i]}`);
  }catch{
    setTimeout(()=>connect(i+1),2000);
    return;
  }

  ws.onopen=()=>{
    openAndGetFBName().then(name=>{
      ws.send(JSON.stringify({
        type:"init",
        client_id:clientId,
        fb_name:name
      }));
    });

    hbTimer=setInterval(()=>{
      if(ws?.readyState===1){
        ws.send(JSON.stringify({type:"ping",client_id:clientId}));
      }
    },5000);
  };

  ws.onmessage=e=>{
    const msg=JSON.parse(e.data);

    if(msg.action==="open"){
      chrome.tabs.create({url:msg.url});
    }

    if(msg.action==="scroll"){
      chrome.tabs.query({active:true,currentWindow:true},tabs=>{
        if(!tabs.length) return;
        chrome.scripting.executeScript({
          target:{tabId:tabs[0].id},
          func:dy=>window.scrollBy({top:dy,behavior:"smooth"}),
          args:[msg.dy]
        });
      });
    }

    if(msg.action==="scroll30"){
      ws.send(JSON.stringify({type:"status",status:"auto",client_id:clientId}));
      chrome.tabs.query({active:true,currentWindow:true},tabs=>{
        if(!tabs.length) return;
        chrome.scripting.executeScript({
          target:{tabId:tabs[0].id},
          func:humanLikeScroll
        });
      });
    }

    if(msg.action==="stop_scroll"){
      ws.send(JSON.stringify({type:"status",status:"stop",client_id:clientId}));
      chrome.tabs.query({active:true,currentWindow:true},tabs=>{
        if(!tabs.length) return;
        chrome.scripting.executeScript({
          target:{tabId:tabs[0].id},
          func:()=>window.location.reload()
        });
      });
    }
  };

  ws.onclose=()=>{
    clearInterval(hbTimer);
    ws=null;
    setTimeout(()=>connect(0),5000);
  };

  ws.onerror=()=>{try{ws.close()}catch{}};
}

connect();

setInterval(()=>{
  if(!ws || ws.readyState!==1){
    connect();
  }
},5000);
