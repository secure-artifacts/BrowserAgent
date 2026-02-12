// ===== 通用工具 =====
var sleep = ms => new Promise(r=>setTimeout(r,ms));
var rand = (a, b) => Math.random() * (b - a) + a;

var isVisible = el=>{
  const r = el.getBoundingClientRect();
  return r.width>0 &&
         r.height>0 &&
         r.bottom>0 &&
         r.top < window.innerHeight*0.85;
};

// ===== 模拟按键输入，带随机延时 =====
async function pressKeyRandomPause(el,key,min=80,max=280){
  const keyCodeMap={
    Escape:27,
    Enter:13,
    Tab:9,
    ArrowUp:38,
    ArrowDown:40,
    ArrowLeft:37,
    ArrowRight:39
  };

  const kc=keyCodeMap[key]||0;

  el.dispatchEvent(new KeyboardEvent("keydown",{
    key,
    code:key,
    keyCode:kc,
    which:kc,
    bubbles:true
  }));

  await sleep(rand(min,max));

  el.dispatchEvent(new KeyboardEvent("keyup",{
    key,
    code:key,
    keyCode:kc,
    which:kc,
    bubbles:true
  }));
}

// ===== 模拟人类点击 =====
function humanClick(el){
  el.click();
  // const r = el.getBoundingClientRect();
  // const x = r.left + r.width/2;
  // const y = r.top + r.height/2;

  // const opts = {
  //   view: window,
  //   bubbles: true,
  //   cancelable: true,
  //   clientX: x,
  //   clientY: y
  // };

  // el.dispatchEvent(new PointerEvent("pointerdown", opts));
  // el.dispatchEvent(new MouseEvent("mousedown", opts));
  // el.dispatchEvent(new PointerEvent("pointerup", opts));
  // el.dispatchEvent(new MouseEvent("mouseup", opts));
  // el.dispatchEvent(new MouseEvent("click", opts));
}


async function waitFor(sel,timeout=4000){
  const t0=Date.now();
  while(Date.now()-t0<timeout){
    const n=document.querySelectorAll(sel);
    if(n.length) return n;
    await sleep(250);
  }
  return null;
}

// ===== 分享到快拍（无语言依赖）=====
async function shareToStory(){

  // 找分享按钮
  const shareBtns = [...document.querySelectorAll('[data-ad-rendering-role="share_button"]')]
    .map(n => n.closest('[role="button"]'))
    .filter(b => b && isVisible(b));

  if(!shareBtns.length) return false;

  const btn = shareBtns[0];

  await sleep(rand(600,1400));
  humanClick(btn);
  await sleep(rand(1600,3200));

  // 找菜单里所有 role="button" 的 div
  const buttons = document.querySelectorAll('[role="button"]');

  const keywords = [
    '限時動態', // 繁体
    '快拍',     // 简体
  ];

  for (let btn of buttons) {
    const text = btn.innerText.trim();
    if (keywords.some(kw => text.includes(kw))) {
      await sleep(rand(200,400));
      humanClick(btn);
      console.log('已点击即时动态按钮:', text);
      return true;
    }
  }

  console.log('未找到即时动态按钮');
  return false;
}

// ===== 点击“感兴趣”按钮（无语言依赖）=====
async function clickInterestedCard(){

  const cards=[
    ...document.querySelectorAll('div')
  ].filter(d=>{
    // 卡片特征：里面有两个可点击按钮
    const btns=d.querySelectorAll('[role="button"][tabindex="0"]');
    return btns.length===2;
  });

  for(const card of cards){

    const btns=[
      ...card.querySelectorAll(
        '[role="button"][tabindex="0"]:not([aria-disabled="true"])'
      )
    ].filter(isVisible);

    if(btns.length!==2) continue;

    const r0=btns[0].getBoundingClientRect();
    const r1=btns[1].getBoundingClientRect();

    // 取更靠左的那个（= 感兴趣）
    const target=r0.left<=r1.left ? btns[0] : btns[1];

    await sleep(rand(300,800));
    humanClick(target);
    return true;
  }

  return false;
}

// ===== 点赞 =====
async function doLike(){

  const nodes=[
    ...document.querySelectorAll(
      '[data-ad-rendering-role="like_button"]'
    )
  ];

  const visible=nodes
    .map(n=>n.closest('[role="button"]'))
    .filter(b=>b && isVisible(b));

  if(!visible.length) return;

  const btn=
    visible[Math.floor(Math.random()*visible.length)];

  await sleep(rand(800,2000));
  humanClick(btn);
  console.log("已点赞");
}

// ===== 评论 =====
async function doComment(){

  const btns = [
    ...document.querySelectorAll('[data-ad-rendering-role="comment_button"]')
  ]
  .map(n=>n.closest('[role="button"]'))
  .filter(b=>b && isVisible(b));

  if(!btns.length) return false;

  const btn = btns[Math.floor(Math.random()*btns.length)];

  await sleep(rand(800,2200));
  humanClick(btn);
  await sleep(rand(1200,2500));

  // 找输入框
  const box = await waitFor('div[contenteditable="true"][role="textbox"]', 5000);
  if(!box || !box.length) return false;
  const input = box[0];

  // 聚焦
  input.focus();

  // 插入文本（FB推荐方式）
  const text = comments[Math.floor(Math.random()*comments.length)];
  document.execCommand(
    "insertText",
    false,
    text
  );

  await sleep(rand(1300,2600));

  // 模拟发送
  await pressKeyRandomPause(input,"Enter");
  console.log("已评论:", text);
  await sleep(rand(1300,2600));

  // 关闭评论框（找 X 号按钮）
  const btns2=[
    ...document.querySelectorAll('div[role="button"]')
  ];

  for(const b of btns2){
    if(!isVisible(b)) continue;

    // 找带 X 图标的按钮
    if(b.querySelector('svg path[d^="M19.884"]')){
      humanClick(b);
      return true;
    }
  }

  // 找不到关闭按钮就按 Esc 吧
  await pressKeyRandomPause(input,"Escape");
  return false;
}


// ===== 随机互动 =====
async function randomInteract(){
  // 优先点击感兴趣卡片
  await clickInterestedCard();

  // 总体低频控制
  if(Math.random()<0.7) return;

  const r=Math.random();

  // ===== 执行 =====
  if(Math.random()<0.1) {
    await doLike();
    await sleep(rand(2500, 8000)); // 分享后停顿
  }
  if(Math.random()<0.1) {
    await shareToStory();
    await sleep(rand(2500, 8000)); // 分享后停顿
  }
  if(Math.random()<0.1) {
    await doComment();
    await sleep(rand(2500, 8000)); // 分享后停顿
  }
}


function humanLikeScroll() {

  // 强制停止旧实例
  if (window.__hsCtrl) {
    window.__hsCtrl.run = false;
    if (window.__hsCtrl.timer) {
      clearTimeout(window.__hsCtrl.timer);
    }
  }

  const ctrl = {
    run: true,
    timer: null,
    start_time: Date.now(),
    scroll_count: 0,
    stop_count: rand(30, 100),
    stop() {
      this.run = false;
      if (this.timer) {
        clearTimeout(this.timer);
        this.timer = null;
      }
      delete window.__hsCtrl;
    }
  };

  window.__hsCtrl = ctrl;

  function smooth(dy, done) {
    const startY = window.scrollY;
    const target = startY + dy;
    const dur = rand(200, 1400);
    const t0 = performance.now();

    function f(t) {
      if (!ctrl.run) return;

      const p = Math.min((t - t0) / dur, 1);
      const e = p < 0.5
        ? 2 * p * p
        : 1 - Math.pow(-2 * p + 2, 2) / 2;

      window.scrollTo(0, startY + (target - startY) * e);

      if (p < 1 && ctrl.run) {
        requestAnimationFrame(f);
      } else if (ctrl.run) {
        done && done();
      }
    }

    requestAnimationFrame(f);
  }
  async function maybeInteract(){
    if (Math.random() < 0.15) {
      try { await randomInteract(); } catch(e){}
    }
  }

  function loop() {
    if (!ctrl.run) return;
    if (document.hidden) {
      ctrl.timer = setTimeout(loop, 4000);
      return;
    }

    const h = document.documentElement.scrollHeight;
    const y = window.scrollY + window.innerHeight;
    const atBottom = y >= h - 5;

    let dy = rand(80, 800);

    if (Math.random() < 0.15) dy *= -1;
    if (atBottom) dy = -rand(300, 900);

    smooth(dy, async () => {
      if (!ctrl.run) return;

      await sleep(rand(800, 1400));
      await maybeInteract();

      const delay = Math.random() < 0.2 ? rand(3000, 8000) : rand(300, 2500);

      ctrl.scroll_count += 1;
      if (ctrl.scroll_count >= ctrl.stop_count) {
        // 每滚动10次，长停一下
        await sleep(rand(5000, 25000));
        ctrl.scroll_count = 0;
        ctrl.stop_count = rand(30, 100);
      }
      ctrl.timer = setTimeout(loop, delay);
    });
  }

  loop();
  return ctrl;
}

var comments=[
  "Nice 🙂",
  "👍",
  "Great post!",
  "Love this",
  "Awesome",
  "🔥",
  "So cool",
  "Well said",
  "Interesting!",
  "Agree 👍",

  "Great shot!",
  "Looks good!",
  "Well done!",
  "Love it 😍",
  "Cool 😎",
  "Amazing work",
  "Nicely done",
  "Good vibes ✨",
  "Really nice",
  "Smart point",
  "True!",
  "Makes sense",
  "Good one 👍",
  "Haha nice",
  "Beautiful",
  "Solid post",
  "Respect ✌️",
  "Brilliant",
  "Not bad 🙂",
  "Very cool",
  "Impressive",
  "Clean 👌",
  "Quality content",
  "This is great",
  "Big fan of this",
  "On point 🎯",
  "Exactly!",
  "Couldn’t agree more",
  "Love the idea",
  "Creative!",
  "Nice share",
  "Appreciate this",
  "Good energy",
  "Super nice",
  "Fresh take",
  "Cool post",
  "That’s cool",
  "Great vibe",
  "Love the vibe",
  "Neat 👍"
];


async function run(){
  // await doLike()
  await doComment();
  // await shareToStory();
  console.log("done");
}

// run();

humanLikeScroll()
