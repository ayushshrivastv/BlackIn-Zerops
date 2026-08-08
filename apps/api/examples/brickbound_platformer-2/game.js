(() => {
  'use strict';

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const UI = {
    score: document.getElementById('scoreValue'), coins: document.getElementById('coinValue'),
    lives: document.getElementById('lifeValue'), level: document.getElementById('levelValue'),
    high: document.getElementById('highValue'), status: document.getElementById('statusText'),
    overlay: document.getElementById('overlay'), overlayTitle: document.getElementById('overlayTitle'),
    overlayText: document.getElementById('overlayText'), overlayBtn: document.getElementById('overlayBtn'),
    pauseBtn: document.getElementById('pauseBtn'), restartBtn: document.getElementById('restartBtn')
  };

  const W = canvas.width, H = canvas.height;
  const GRAVITY = 2050;
  const MAX_FALL = 1050;
  const MOVE_SPEED = 390;
  const JUMP_SPEED = 770;
  const GROUND_ACCEL = 3000;
  const AIR_ACCEL = 1750;
  const GROUND_DECEL = 3400;
  const FIXED_DT = 1 / 120;
  const MAX_STEPS = 8;

  const state = {
    running: false, paused: false, gameOver: false, won: false,
    levelIndex: 0, score: 0, coins: 0, lives: 3,
    high: Number(localStorage.getItem('brickboundHighScore') || 0),
    checkpoint: null, cameraX: 0, shake: 0, last: 0, accumulator: 0,
    input: { left: false, right: false, jump: false, jumpPressed: false },
    particles: [], world: null, player: null
  };

  const LEVELS = [
    {
      name: 'Meadow Run', width: 3900, sky: ['#78d7ff', '#dff6ff'],
      platforms: [
        [0,650,780,70],[900,650,520,70],[1510,650,660,70],[2280,650,520,70],[2910,650,990,70],
        [360,515,220,30],[1040,500,180,30],[1300,400,180,30],[1740,520,220,30],[1980,420,180,30],
        [2380,510,180,30],[2640,410,180,30],[3060,500,180,30],[3330,395,200,30]
      ],
      coins: [[410,470],[480,470],[1090,455],[1350,355],[1420,355],[1795,475],[2030,375],[2440,465],[2700,365],[3120,455],[3395,350],[3480,350]],
      enemies: [[720,610],[1180,610],[1650,610],[2520,610],[3200,610]],
      powers: [[1335,350,'boost'],[2665,360,'shield']], checkpoints: [[2050,600]], goal: [3720,540]
    },
    {
      name: 'Sunset Foundry', width: 4700, sky: ['#ffab6b', '#50306f'],
      platforms: [
        [0,650,620,70],[720,650,450,70],[1280,650,520,70],[1900,650,390,70],[2420,650,500,70],[3040,650,420,70],[3600,650,1100,70],
        [260,500,180,30],[800,470,190,30],[1070,370,160,30],[1390,500,210,30],[1660,405,170,30],[1990,500,180,30],
        [2500,500,180,30],[2780,390,190,30],[3130,500,180,30],[3360,390,170,30],[3770,500,170,30],[4050,390,220,30]
      ],
      coins: [[310,455],[850,425],[1120,325],[1440,455],[1510,455],[1710,360],[2040,455],[2560,455],[2835,345],[3180,455],[3410,345],[3820,455],[4100,345],[4180,345]],
      enemies: [[540,610],[970,610],[1480,610],[2140,610],[2720,610],[3300,610],[3920,610],[4400,610]],
      powers: [[1090,320,'boost'],[3385,340,'shield']], checkpoints: [[2320,600],[3540,600]], goal: [4515,540]
    },
    {
      name: 'Cloudline', width: 5200, sky: ['#3447a5', '#7bc6ff'],
      platforms: [
        [0,650,520,70],[650,650,420,70],[1220,650,460,70],[1820,650,390,70],[2370,650,460,70],[2980,650,410,70],[3530,650,500,70],[4180,650,1020,70],
        [180,510,190,28],[730,500,190,28],[990,390,180,28],[1300,500,190,28],[1570,390,180,28],[1900,500,180,28],
        [2440,500,180,28],[2700,390,180,28],[3060,500,180,28],[3310,385,180,28],[3650,500,190,28],[3910,390,180,28],[4300,500,180,28],[4580,390,210,28]
      ],
      coins: [[230,465],[780,455],[1040,345],[1350,455],[1620,345],[1950,455],[2490,455],[2750,345],[3110,455],[3360,340],[3700,455],[3960,345],[4350,455],[4630,345],[4710,345]],
      enemies: [[460,610],[900,610],[1450,610],[2040,610],[2600,610],[3200,610],[3820,610],[4470,610],[4910,610]],
      powers: [[1015,340,'boost'],[3290,335,'shield'],[4590,340,'boost']], checkpoints: [[2260,600],[4110,600]], goal: [5035,540]
    }
  ];

  class AudioKit {
    constructor() { this.ctx = null; this.enabled = true; }
    ensure() { if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)(); }
    tone(freq=440, duration=.08, type='square', gain=.04, slide=0) {
      if (!this.enabled) return;
      this.ensure();
      const t = this.ctx.currentTime, o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, t); o.frequency.linearRampToValueAtTime(Math.max(50, freq+slide), t+duration);
      g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(.0001, t+duration);
      o.connect(g).connect(this.ctx.destination); o.start(t); o.stop(t+duration);
    }
    jump(){ this.tone(420,.12,'square',.035,220); }
    coin(){ this.tone(850,.06,'square',.04,230); setTimeout(()=>this.tone(1200,.05,'square',.03,120),50); }
    hit(){ this.tone(150,.18,'sawtooth',.05,-70); }
    stomp(){ this.tone(240,.07,'square',.05,80); }
    power(){ [440,660,880].forEach((f,i)=>setTimeout(()=>this.tone(f,.09,'triangle',.04,90),i*60)); }
    checkpoint(){ [520,700,920].forEach((f,i)=>setTimeout(()=>this.tone(f,.08,'sine',.035,60),i*55)); }
    win(){ [523,659,784,1046].forEach((f,i)=>setTimeout(()=>this.tone(f,.13,'triangle',.04,100),i*90)); }
  }
  const audio = new AudioKit();

  function aabb(a,b){ return a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y; }
  function clamp(v,min,max){ return Math.max(min,Math.min(max,v)); }
  function lerp(a,b,t){ return a+(b-a)*t; }

  function particleBurst(x,y,color,count=12,speed=280) {
    for (let i=0;i<count;i++) {
      const a=Math.random()*Math.PI*2, s=speed*(.35+Math.random()*.65);
      state.particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-80,life:.5+Math.random()*.35,max:.85,size:3+Math.random()*6,color});
    }
  }

  function makeWorld(level) {
    return {
      ...level,
      platforms: level.platforms.map(([x,y,w,h])=>({x,y,w,h})),
      coins: level.coins.map(([x,y])=>({x,y,w:28,h:28,t:Math.random()*6.2,collected:false})),
      enemies: level.enemies.map(([x,y],i)=>({x,y,w:48,h:40,vx:(i%2?1:-1)*72,alive:true,phase:Math.random()*4})),
      powers: level.powers.map(([x,y,type])=>({x,y,w:36,h:36,type,collected:false,t:0})),
      checkpoints: level.checkpoints.map(([x,y])=>({x,y,w:26,h:50,active:false})),
      goal: {x:level.goal[0], y:level.goal[1], w:46, h:110}
    };
  }

  function spawnPlayer(atCheckpoint=true) {
    const cp = atCheckpoint && state.checkpoint;
    state.player = { x:cp?cp.x:80, y:cp?cp.y-64:560, w:44, h:58, vx:0, vy:0, onGround:false, coyote:0, jumpBuffer:0, facing:1, invuln:0, shield:0, speedBoost:0, squash:0 };
    state.cameraX = clamp(state.player.x-180,0,Math.max(0,state.world.width-W));
  }

  function loadLevel(index, keepCheckpoint=false) {
    state.levelIndex = index;
    state.world = makeWorld(LEVELS[index]);
    state.checkpoint = keepCheckpoint ? state.checkpoint : null;
    spawnPlayer(keepCheckpoint);
    updateHUD();
    UI.status.textContent = state.world.name;
  }

  function updateHUD() {
    UI.score.textContent = state.score;
    UI.coins.textContent = state.coins;
    UI.lives.textContent = state.lives;
    UI.level.textContent = `${state.levelIndex+1}/${LEVELS.length}`;
    UI.high.textContent = state.high;
  }

  function saveHighScore() {
    if (state.score > state.high) {
      state.high = state.score;
      localStorage.setItem('brickboundHighScore', String(state.high));
    }
    updateHUD();
  }

  function setOverlay(title,text,button='Continue',visible=true) {
    UI.overlayTitle.textContent=title; UI.overlayText.textContent=text; UI.overlayBtn.textContent=button;
    UI.overlay.classList.toggle('visible',visible);
  }

  function startNewGame() {
    state.score=0; state.coins=0; state.lives=3; state.gameOver=false; state.won=false; state.paused=false; state.running=true; state.checkpoint=null;
    loadLevel(0); setOverlay('','','',false); audio.ensure();
  }

  function restartLevel() {
    if (!state.world) return startNewGame();
    state.score=Math.max(0,state.score-100); state.paused=false; state.running=true;
    loadLevel(state.levelIndex,false); setOverlay('','','',false);
  }

  function togglePause() {
    if (!state.running || state.gameOver || state.won) return;
    state.paused=!state.paused;
    UI.pauseBtn.textContent=state.paused?'Resume':'Pause';
    setOverlay('Paused','Press P, Escape, or Resume to jump back in.','Resume',state.paused);
    UI.status.textContent=state.paused?'Paused':state.world.name;
  }

  function hurtPlayer() {
    const p=state.player;
    if (p.invuln>0) return;
    if (p.shield>0) { p.shield=0; p.invuln=1.1; particleBurst(p.x+p.w/2,p.y+p.h/2,'#7df3ff',18,330); audio.hit(); return; }
    state.lives--; saveHighScore(); audio.hit(); state.shake=12;
    if (state.lives<=0) {
      state.gameOver=true; state.running=false;
      setOverlay('Game Over',`Final score: ${state.score}. High score: ${state.high}.`,'Play Again',true);
      UI.status.textContent='Game over';
    } else {
      spawnPlayer(true); state.player.invuln=1.5; updateHUD();
    }
  }

  function finishLevel() {
    state.score += 1000 + state.levelIndex*500; saveHighScore(); audio.win();
    if (state.levelIndex < LEVELS.length-1) {
      state.running=false;
      setOverlay('Level Clear!',`${state.world.name} complete. Next up: ${LEVELS[state.levelIndex+1].name}.`,'Next Level',true);
    } else {
      state.won=true; state.running=false;
      setOverlay('You Did It!',`All ${LEVELS.length} levels cleared with ${state.score} points. High score: ${state.high}.`,'Play Again',true);
      UI.status.textContent='All levels cleared';
    }
  }

  function update(dt) {
    if (!state.running || state.paused) return;
    const p=state.player, world=state.world;
    p.invuln=Math.max(0,p.invuln-dt); p.shield=Math.max(0,p.shield-dt); p.speedBoost=Math.max(0,p.speedBoost-dt);
    p.jumpBuffer=Math.max(0,p.jumpBuffer-dt); p.coyote=Math.max(0,p.coyote-dt);
    if (state.input.jumpPressed) p.jumpBuffer=.13;
    state.input.jumpPressed=false;

    const speed=MOVE_SPEED*(p.speedBoost>0?1.35:1);
    const direction=(state.input.right?1:0)-(state.input.left?1:0);
    if (direction) {
      const accel=p.onGround?GROUND_ACCEL:AIR_ACCEL;
      p.vx += clamp(direction*speed-p.vx,-accel*dt,accel*dt);
    } else if (p.onGround) {
      const drop=GROUND_DECEL*dt;
      p.vx=Math.abs(p.vx)<=drop?0:p.vx-Math.sign(p.vx)*drop;
    } else {
      p.vx*=Math.pow(.82,dt);
    }
    if (Math.abs(p.vx)>10) p.facing=Math.sign(p.vx);

    if (p.jumpBuffer>0 && (p.onGround||p.coyote>0)) {
      p.vy=-JUMP_SPEED; p.onGround=false; p.coyote=0; p.jumpBuffer=0; audio.jump();
      particleBurst(p.x+p.w/2,p.y+p.h,'#e8f4ff',7,120);
    }
    const risingGravity=p.vy<0?(state.input.jump ? 0.88 : 1.65):1.08;
    p.vy = Math.min(MAX_FALL,p.vy+GRAVITY*risingGravity*dt);

    p.x += p.vx*dt;
    for (const b of world.platforms) if (aabb(p,b)) {
      if (p.vx>0) p.x=b.x-p.w; else if (p.vx<0) p.x=b.x+b.w;
      p.vx=0;
    }

    const prevBottom=p.y+p.h;
    p.y += p.vy*dt; p.onGround=false;
    for (const b of world.platforms) if (aabb(p,b)) {
      if (p.vy>=0 && prevBottom<=b.y+14) {
        p.y=b.y-p.h; p.vy=0; p.onGround=true; p.coyote=.11;
      } else if (p.vy<0) { p.y=b.y+b.h; p.vy=80; }
    }
    p.x=clamp(p.x,0,world.width-p.w);
    if (p.y>H+220) { hurtPlayer(); return; }

    for (const c of world.coins) if (!c.collected) {
      c.t+=dt*5;
      if (aabb(p,{x:c.x,y:c.y,w:c.w,h:c.h})) {
        c.collected=true; state.coins++; state.score+=100; audio.coin(); particleBurst(c.x+14,c.y+14,'#ffd94d',14,260);
        if (state.coins%20===0) { state.lives++; UI.status.textContent='Bonus life!'; }
        saveHighScore();
      }
    }

    for (const e of world.enemies) if (e.alive) {
      e.phase+=dt*5; e.x+=e.vx*dt;
      const front={x:e.vx>0?e.x+e.w:e.x-3,y:e.y+e.h-2,w:3,h:8};
      const edgeGround=world.platforms.some(b=>aabb(front,b));
      if (!edgeGround || e.x<0 || e.x+e.w>world.width) e.vx*=-1;
      for (const b of world.platforms) if (aabb(e,b) && b.y<e.y+e.h-4) { e.vx*=-1; e.x+=e.vx*dt*2; }
      if (aabb(p,e)) {
        const stomp=p.vy>160 && p.y+p.h-e.y<24;
        if (stomp) { e.alive=false; p.vy=-480; state.score+=250; audio.stomp(); particleBurst(e.x+e.w/2,e.y+e.h/2,'#ff8e67',18,300); saveHighScore(); }
        else { hurtPlayer(); return; }
      }
    }

    for (const power of world.powers) if (!power.collected) {
      power.t+=dt;
      if (aabb(p,power)) {
        power.collected=true; state.score+=300; audio.power(); particleBurst(power.x+18,power.y+18,power.type==='shield'?'#7df3ff':'#a8ff70',20,320);
        if (power.type==='shield') { p.shield=12; UI.status.textContent='Shield active'; }
        else { p.speedBoost=12; UI.status.textContent='Speed boost active'; }
        saveHighScore();
      }
    }

    for (const cp of world.checkpoints) {
      if (!cp.active && aabb(p,cp)) {
        world.checkpoints.forEach(x=>x.active=false); cp.active=true; state.checkpoint={x:cp.x,y:cp.y}; state.score+=200;
        audio.checkpoint(); particleBurst(cp.x+13,cp.y+16,'#4ee6a8',22,280); UI.status.textContent='Checkpoint activated'; saveHighScore();
      }
    }

    if (aabb(p,world.goal)) finishLevel();

    for (const q of state.particles) { q.life-=dt; q.x+=q.vx*dt; q.y+=q.vy*dt; q.vy+=700*dt; q.vx*=Math.pow(.35,dt); }
    state.particles=state.particles.filter(q=>q.life>0);

    const desired=clamp(p.x-W*.34,0,Math.max(0,world.width-W));
    state.cameraX=lerp(state.cameraX,desired,1-Math.pow(.0001,dt));
    state.shake*=Math.pow(.03,dt);
  }

  function roundRect(x,y,w,h,r,fill) {
    ctx.beginPath(); ctx.roundRect(x,y,w,h,r); ctx.fillStyle=fill; ctx.fill();
  }

  function drawBackground() {
    const world=state.world||LEVELS[0];
    const grad=ctx.createLinearGradient(0,0,0,H); grad.addColorStop(0,world.sky[0]); grad.addColorStop(1,world.sky[1]);
    ctx.fillStyle=grad; ctx.fillRect(0,0,W,H);
    const cam=state.cameraX||0;
    ctx.globalAlpha=.18; ctx.fillStyle='#fff';
    for (let i=0;i<14;i++) {
      const x=((i*430-cam*.15)%1800+1800)%1800-220, y=80+(i%4)*70;
      ctx.beginPath(); ctx.ellipse(x,y,120,34,0,0,Math.PI*2); ctx.fill();
    }
    ctx.globalAlpha=.12;
    ctx.fillStyle='#13243a';
    for (let i=0;i<20;i++) {
      const x=((i*310-cam*.35)%2200+2200)%2200-180, h=90+(i%5)*35;
      ctx.beginPath(); ctx.moveTo(x,H-70); ctx.lineTo(x+130,H-70-h); ctx.lineTo(x+260,H-70); ctx.fill();
    }
    ctx.globalAlpha=1;
  }

  function drawWorld() {
    const world=state.world; if (!world) return;
    const shakeX=(Math.random()-.5)*state.shake, shakeY=(Math.random()-.5)*state.shake;
    ctx.save(); ctx.translate(-state.cameraX+shakeX,shakeY);

    for (const b of world.platforms) {
      roundRect(b.x,b.y,b.w,b.h,8,'#6f4a2e');
      roundRect(b.x,b.y,b.w,Math.min(12,b.h),8,'#a9d35c');
      ctx.fillStyle='rgba(255,255,255,.08)';
      for(let x=b.x+18;x<b.x+b.w-8;x+=44) ctx.fillRect(x,b.y+22,18,5);
    }

    for (const c of world.coins) if (!c.collected) {
      const squeeze=.38+.62*Math.abs(Math.sin(c.t));
      ctx.save(); ctx.translate(c.x+14,c.y+14); ctx.scale(squeeze,1);
      ctx.fillStyle='#ffd84d'; ctx.beginPath(); ctx.ellipse(0,0,13,16,0,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle='#fff2a1'; ctx.lineWidth=4; ctx.stroke(); ctx.restore();
    }

    for (const power of world.powers) if (!power.collected) {
      const bob=Math.sin(power.t*4)*6;
      ctx.save(); ctx.translate(power.x,power.y+bob);
      roundRect(0,0,36,36,10,power.type==='shield'?'#4ddcf5':'#9af255');
      ctx.fillStyle='#0c2530'; ctx.font='bold 21px system-ui'; ctx.textAlign='center'; ctx.fillText(power.type==='shield'?'S':'B',18,25); ctx.restore();
    }

    for (const cp of world.checkpoints) {
      ctx.fillStyle='#eaf6ff'; ctx.fillRect(cp.x+10,cp.y,6,50);
      ctx.fillStyle=cp.active?'#4ee6a8':'#8da2b7';
      ctx.beginPath(); ctx.moveTo(cp.x+16,cp.y+2); ctx.lineTo(cp.x+48,cp.y+13); ctx.lineTo(cp.x+16,cp.y+25); ctx.fill();
    }

    const g=world.goal;
    ctx.fillStyle='#ecf7ff'; ctx.fillRect(g.x+20,g.y,8,g.h);
    ctx.shadowBlur=24; ctx.shadowColor='#ffd84d'; ctx.fillStyle='#ffd84d'; ctx.beginPath(); ctx.arc(g.x+24,g.y+8,22,0,Math.PI*2); ctx.fill(); ctx.shadowBlur=0;

    for (const e of world.enemies) if (e.alive) {
      const bob=Math.sin(e.phase)*2;
      ctx.save(); ctx.translate(e.x,e.y+bob);
      roundRect(0,4,e.w,e.h-4,14,'#d66a45');
      ctx.fillStyle='#fff'; ctx.fillRect(10,12,9,11); ctx.fillRect(29,12,9,11);
      ctx.fillStyle='#192230'; ctx.fillRect(14,16,4,6); ctx.fillRect(30,16,4,6);
      ctx.fillStyle='#4a2b23'; ctx.fillRect(4,e.h-5,14,7); ctx.fillRect(30,e.h-5,14,7);
      ctx.restore();
    }

    drawPlayer();

    for (const q of state.particles) {
      ctx.globalAlpha=clamp(q.life/q.max,0,1); ctx.fillStyle=q.color; ctx.fillRect(q.x-q.size/2,q.y-q.size/2,q.size,q.size);
    }
    ctx.globalAlpha=1; ctx.restore();
  }

  function drawPlayer() {
    const p=state.player; if (!p) return;
    if (p.invuln>0 && Math.floor(p.invuln*12)%2===0) return;
    ctx.save(); ctx.translate(p.x+p.w/2,p.y+p.h/2); if(p.facing<0) ctx.scale(-1,1);
    if (p.speedBoost>0) { ctx.globalAlpha=.22; for(let i=1;i<=3;i++){ ctx.fillStyle='#a8ff70'; ctx.fillRect(-p.w/2-i*10,-p.h/2+12,p.w-8,p.h-18); } ctx.globalAlpha=1; }
    roundRect(-20,-26,40,50,11,'#ef4f57');
    roundRect(-16,-7,32,29,8,'#3478e5');
    ctx.fillStyle='#ffd7b4'; ctx.fillRect(-14,-25,28,16);
    ctx.fillStyle='#6a3426'; ctx.fillRect(4,-19,11,5);
    ctx.fillStyle='#fff'; ctx.fillRect(7,-23,6,7); ctx.fillStyle='#16202a'; ctx.fillRect(10,-21,3,4);
    ctx.fillStyle='#27354b'; ctx.fillRect(-18,20,14,8); ctx.fillRect(5,20,14,8);
    if (p.shield>0) { ctx.strokeStyle='rgba(125,243,255,.8)'; ctx.lineWidth=4; ctx.beginPath(); ctx.arc(0,0,36+Math.sin(performance.now()/90)*2,0,Math.PI*2); ctx.stroke(); }
    ctx.restore();
  }

  function draw() { drawBackground(); drawWorld(); }

  function fitCanvas() {
    const wrap=canvas.parentElement;
    const rect=wrap.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const scale=Math.min(rect.width/W,rect.height/H);
    canvas.style.width=`${Math.max(1,Math.floor(W*scale))}px`;
    canvas.style.height=`${Math.max(1,Math.floor(H*scale))}px`;
  }

  function loop(t) {
    const frameDt=Math.min(.05,(t-state.last)/1000||0); state.last=t;
    state.accumulator=Math.min(state.accumulator+frameDt,FIXED_DT*MAX_STEPS);
    let steps=0;
    while (state.accumulator>=FIXED_DT && steps<MAX_STEPS) {
      update(FIXED_DT);
      state.accumulator-=FIXED_DT;
      steps++;
    }
    draw(); requestAnimationFrame(loop);
  }

  function setKey(code,down) {
    if (['ArrowLeft','KeyA'].includes(code)) state.input.left=down;
    if (['ArrowRight','KeyD'].includes(code)) state.input.right=down;
    if (['ArrowUp','KeyW','Space'].includes(code)) { if(down&&!state.input.jump) state.input.jumpPressed=true; state.input.jump=down; }
  }
  window.addEventListener('keydown',e=>{
    if (['ArrowLeft','ArrowRight','ArrowUp','Space'].includes(e.code)) e.preventDefault();
    if (!e.repeat && ['KeyP','Escape'].includes(e.code)) togglePause();
    if (!e.repeat && e.code==='KeyR') restartLevel();
    setKey(e.code,true);
  },{passive:false});
  window.addEventListener('keyup',e=>setKey(e.code,false));

  function bindHold(id,key) {
    const el=document.getElementById(id);
    const on=e=>{e.preventDefault(); if(key==='jump'&&!state.input.jump) state.input.jumpPressed=true; state.input[key]=true;};
    const off=e=>{e.preventDefault(); state.input[key]=false;};
    ['pointerdown','touchstart'].forEach(evt=>el.addEventListener(evt,on,{passive:false}));
    ['pointerup','pointercancel','pointerleave','touchend'].forEach(evt=>el.addEventListener(evt,off,{passive:false}));
  }
  bindHold('leftBtn','left'); bindHold('rightBtn','right'); bindHold('jumpBtn','jump');

  UI.pauseBtn.addEventListener('click',togglePause);
  UI.restartBtn.addEventListener('click',restartLevel);
  UI.overlayBtn.addEventListener('click',()=>{
    if (state.gameOver||state.won||!state.world) return startNewGame();
    if (!state.running && state.levelIndex<LEVELS.length-1) {
      state.levelIndex++; state.checkpoint=null; loadLevel(state.levelIndex); state.running=true; setOverlay('','','',false); return;
    }
    if (state.paused) togglePause(); else startNewGame();
  });
  window.addEventListener('blur',()=>{ if(state.running&&!state.paused) togglePause(); });
  window.addEventListener('resize',fitCanvas,{passive:true});
  if ('ResizeObserver' in window) new ResizeObserver(fitCanvas).observe(canvas.parentElement);

  UI.high.textContent=state.high;
  loadLevel(0);
  state.running=false;
  fitCanvas();
  requestAnimationFrame(loop);
})();
