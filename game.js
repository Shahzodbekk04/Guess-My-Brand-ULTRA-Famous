(() => {
'use strict';

const DATA = window.GMB_DATA;
const BRANDS = Array.isArray(window.BRANDS) ? window.BRANDS : [];
const SAVE_KEY = 'gmb-ultra-profile-v1';
const SAVE_VERSION = 1;
const LEVELS = {
  easy:{label:'OSON',time:15,botMin:5.2,botMax:7.2,accuracy:.66,mult:1},
  medium:{label:'O‘RTACHA',time:10,botMin:3.0,botMax:4.2,accuracy:.84,mult:1.25},
  hard:{label:'QIYIN',time:6,botMin:1.45,botMax:2.35,accuracy:.94,mult:1.6}
};
// Ta'rifdan Top rejimida matnni bemalol o'qish uchun alohida vaqtlar.
// Oddiy logo rejimlarining vaqti o'zgarmaydi.
const DESCRIPTION_LEVELS = {
  easy:{time:25,botMin:11,botMax:14},
  medium:{time:18,botMin:8,botMax:10.5},
  hard:{time:12,botMin:5.5,botMax:7}
};
const ALIASES = {
  'mercedes-benz':['mercedes','mercedes benz','mercedesbenz'], 'coca-cola':['coca cola','cocacola','coke'],
  "mcdonald's":['mcdonalds','mc donalds'], "domino's":['dominos','domino'], "lay's":['lays'], 'h&m':['hm','h and m','h m'],
  'louis vuitton':['lv','louisvitton'], 'new balance':['nb','newbalance'], 'under armour':['under armor','underarmour'],
  'red bull':['redbull'], 'burger king':['burgerking','bk'], 'pizza hut':['pizzahut'], 'playstation':['ps','play station'],
  'epic games':['epic','epicgames'], 'electronic arts':['ea','ea games'], 'mastercard':['master card'], 'aliexpress':['ali express'],
  'x':['twitter','x twitter'], 'youtube':['you tube'], 'whatsapp':['whats app'], 'linkedin':['linked in'], 'chatgpt':['chat gpt']
};
const AVATARS = {avatar_smile:'🙂',avatar_fox:'🦊',avatar_robot:'🤖',avatar_crown:'👑'};
const DEFAULT_PROFILE = {
  version:SAVE_VERSION,name:'O‘yinchi',xp:0,coins:250,wins:0,losses:0,games:0,correct:0,wrong:0,totalRounds:0,
  bestStreak:0,bestBlitz:0,bestSurvival:0,bestSpeed:99,collection:{},categoryStats:{},achievements:{},
  inventory:{fifty:1,freeze:1,slow:1,reveal:1,shield:0},owned:['bg_default','avatar_smile'],
  equipped:{background:'bg_default',avatar:'avatar_smile',frame:''},careerCompleted:0,
  settings:{lite:true,theme:'dark',sfx:true,music:false},daily:{date:'',progress:{play:0,correct:0,streak:0},claimed:{}},weekly:{key:'',best:0}
};

const $ = id => document.getElementById(id);
const els = {};
[
'menuScreen','gameScreen','resultScreen','quickPlayBtn','difficultySelect','botSelect','avatarBtn','avatarEmoji','profileName','levelText','menuXP','menuXPBar','menuCoins','collectionMini','achievementMini','dailyStrip',
'playerAvatar','playerLabel','playerScore','modeLabel','roundLabel','timerText','timerBar','botName','botScore','botEmoji','streakValue','xpGainValue','coinGainValue','pauseBtn',
'botFace','botStatus','botBubble','bossBadge','riskBadge','pFifty','pFreeze','pSlow','pReveal','pShield','questionTitle','logoCard','logoLoading','logoViewport','brandLogo','textQuestion','fallbackLogo','qualityBadge',
'feedback','answerReveal','answerRevealKicker','answerRevealName','answerRevealVisual','answerRevealImg','answerRevealNote','answerForm','answerInput','submitBtn','choiceGrid','hintLetterBtn','hintCategoryBtn','hintTimeBtn','hintLetterCount','hintCategoryCount','hintTimeCount','hintText','sourceText','retryLogoBtn','historyList','missionProgress',
'resultEmoji','resultTitle','resultText','finalPlayerLabel','finalPlayer','finalBotLabel','finalBot','finalXP','finalCoins','finalStreak','rankText','factCard','playAgainBtn','resultMenuBtn',
'pauseOverlay','resumeBtn','stopBtn','pauseMenuBtn','modalOverlay','modalKicker','modalTitle','modalBody','modalClose','toast'
].forEach(id => els[id] = $(id));

let profile = loadProfile();
let state = null;
let difficulty = 'easy';
let botId = 'hazilkash';
let rafId = 0;
let roundToken = 0;
let toastTimer = 0;
let lastModeSpec = {mode:'classic',opts:{}};
let musicNodes = [];
let logoDBPromise = null;

function clone(obj){ return JSON.parse(JSON.stringify(obj)); }
function mergeProfile(raw){
  const base = clone(DEFAULT_PROFILE);
  if(!raw || typeof raw !== 'object') return base;
  const out = {...base,...raw};
  out.settings = {...base.settings,...(raw.settings||{})}; out.inventory = {...base.inventory,...(raw.inventory||{})};
  out.equipped = {...base.equipped,...(raw.equipped||{})}; out.daily = {...base.daily,...(raw.daily||{})};
  out.daily.progress = {...base.daily.progress,...(raw.daily?.progress||{})}; out.daily.claimed = {...(raw.daily?.claimed||{})};
  out.weekly = {...base.weekly,...(raw.weekly||{})};
  const allowedBrands = new Set(BRANDS.map(b=>b.name));
  out.collection = Object.fromEntries(Object.entries(raw.collection||{}).filter(([name])=>allowedBrands.has(name)));
  out.categoryStats = raw.categoryStats||{};
  const allowedAchievements = new Set((DATA.achievements||[]).map(a=>a.id));
  out.achievements = Object.fromEntries(Object.entries(raw.achievements||{}).filter(([id])=>allowedAchievements.has(id)));
  out.owned = Array.isArray(raw.owned)?raw.owned:base.owned;
  return out;
}
function loadProfile(){
  try{return mergeProfile(JSON.parse(localStorage.getItem(SAVE_KEY)||'null'));}catch(_){return clone(DEFAULT_PROFILE);}
}
function saveProfile(){ try{ localStorage.setItem(SAVE_KEY,JSON.stringify(profile)); }catch(_){ /* storage full: game continues */ } updateMenu(); }
function localDateKey(){ const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function weekKey(){ const d=new Date(); const onejan=new Date(d.getFullYear(),0,1); const w=Math.ceil((((d-onejan)/86400000)+onejan.getDay()+1)/7); return `${d.getFullYear()}-W${w}`; }
function ensureResets(){
  const day=localDateKey(); if(profile.daily.date!==day) profile.daily={date:day,progress:{play:0,correct:0,streak:0},claimed:{}};
  const wk=weekKey(); if(profile.weekly.key!==wk) profile.weekly={key:wk,best:0};
  saveProfile();
}
function levelInfo(xp=profile.xp){ const level=Math.floor(Math.sqrt(Math.max(0,xp)/180))+1; const prev=(level-1)*(level-1)*180; const next=level*level*180; return {level,prev,next,ratio:Math.max(0,Math.min(1,(xp-prev)/(next-prev||1)))}; }
function rankName(xp=profile.xp){ if(xp>=7500)return'👑 BREND USTASI'; if(xp>=5000)return'💎 LOGO OVCHISI'; if(xp>=3000)return'🥇 BREND BILIMDONI'; if(xp>=1500)return'🥈 KUCHLI TOPUVCHI'; if(xp>=600)return'🥉 BREND IZQUVARI'; return'🌱 YANGI IZQUVAR'; }
function showScreen(el){ [els.menuScreen,els.gameScreen,els.resultScreen].forEach(x=>x.classList.remove('active')); el.classList.add('active'); }
function escapeHtml(s){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
function normalize(s){return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/&/g,'and').replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');}
function isCorrect(input,name){ const a=normalize(input),b=normalize(name); if(a===b)return true; return (ALIASES[name.toLowerCase()]||[]).some(x=>normalize(x)===a); }
function shuffle(a){a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function rand(min,max){return min+Math.random()*(max-min)}
function clamp(v,a,b){return Math.max(a,Math.min(b,v))}

function init(){
  ensureResets(); applySettings(); populateBots(); bindEvents(); updateMenu(); showScreen(els.menuScreen);
  if(profile.settings.music) startMusic();
}
function populateBots(){
  els.botSelect.innerHTML=''; DATA.botPersonalities.forEach(b=>{const o=document.createElement('option');o.value=b.id;o.textContent=`${b.emoji} ${b.name}`;els.botSelect.appendChild(o);});
  els.botSelect.value=botId;
}
function bindEvents(){
  els.quickPlayBtn.addEventListener('click',()=>{difficulty=els.difficultySelect.value;botId=els.botSelect.value;startMode('classic',{});});
  els.difficultySelect.addEventListener('change',()=>difficulty=els.difficultySelect.value);
  els.botSelect.addEventListener('change',()=>botId=els.botSelect.value);
  document.querySelectorAll('.menu-card').forEach(b=>b.addEventListener('click',()=>handleMenuAction(b.dataset.action)));
  els.avatarBtn.addEventListener('click',()=>openProfile());
  els.answerForm.addEventListener('submit',e=>{e.preventDefault();submitTextAnswer();});
  els.pauseBtn.addEventListener('click',pauseGame); els.resumeBtn.addEventListener('click',resumeGame); els.stopBtn.addEventListener('click',()=>endGame('stopped')); els.pauseMenuBtn.addEventListener('click',returnToMenu);
  els.playAgainBtn.addEventListener('click',()=>startMode(lastModeSpec.mode,lastModeSpec.opts)); els.resultMenuBtn.addEventListener('click',returnToMenu);
  els.modalClose.addEventListener('click',closeModal); els.modalOverlay.addEventListener('click',e=>{if(e.target===els.modalOverlay)closeModal();});
  els.retryLogoBtn.addEventListener('click',retryCurrentLogo);
  els.hintLetterBtn.addEventListener('click',()=>useHint('letter')); els.hintCategoryBtn.addEventListener('click',()=>useHint('category')); els.hintTimeBtn.addEventListener('click',()=>useHint('time'));
  document.querySelectorAll('.powers button').forEach(b=>b.addEventListener('click',()=>usePower(b.dataset.power)));
  window.addEventListener('keydown',e=>{
    if(e.key==='F11'){ e.preventDefault();toggleFullscreen(); return; }
    if(e.key==='Escape'){
      if(!els.modalOverlay.classList.contains('hidden')){closeModal();return;}
      if(state && els.gameScreen.classList.contains('active')){e.preventDefault();state.paused?resumeGame():pauseGame();} return;
    }
    if(!state||state.paused||state.roundEnded||state.loading)return;
    if(e.key==='1')useHint('letter');if(e.key==='2')useHint('category');if(e.key==='3')useHint('time');
  });
  window.addEventListener('beforeunload',()=>{saveProfile();cleanupGame();});
}

function applySettings(){
  document.body.classList.toggle('lite-mode',!!profile.settings.lite);
  document.body.classList.toggle('theme-light',profile.settings.theme==='light');
  document.body.classList.toggle('theme-dark',profile.settings.theme!=='light');
  [...document.body.classList].filter(c=>c.startsWith('bg_')).forEach(c=>document.body.classList.remove(c));
  document.body.classList.add(profile.equipped.background||'bg_default');document.body.dataset.frame=profile.equipped.frame||'';
}
function updateMenu(){
  const li=levelInfo(); const avatar=AVATARS[profile.equipped.avatar]||'🙂';
  els.avatarEmoji.textContent=avatar;els.profileName.textContent=profile.name;els.levelText.textContent=`${li.level}-daraja • ${rankName()}`;
  els.menuXP.textContent=`${profile.xp} XP`;els.menuXPBar.style.width=`${li.ratio*100}%`;els.menuCoins.textContent=profile.coins;
  els.collectionMini.textContent=`${Object.keys(profile.collection).length} / ${BRANDS.length}`;els.achievementMini.textContent=`${Object.keys(profile.achievements).length} / ${DATA.achievements.length}`;
  const d=profile.daily.progress;els.dailyStrip.textContent=`📅 Bugun: O‘yin ${d.play}/3 • To‘g‘ri ${d.correct}/15 • Streak ${Math.min(d.streak,5)}/5`;
}
function handleMenuAction(action){
  const map={career:openCareer,modes:openModes,description:()=>startMode('description',{}),collection:openCollection,shop:openShop,missions:openMissions,achievements:openAchievements,stats:openStats,leaderboard:openLeaderboard,settings:openSettings};
  if(map[action])map[action]();
}
function openModal(title,html,kicker='GUESS MY BRAND ULTRA'){
  els.modalTitle.textContent=title;els.modalKicker.textContent=kicker;els.modalBody.innerHTML=html;els.modalOverlay.classList.remove('hidden');
}
function closeModal(){els.modalOverlay.classList.add('hidden');els.modalBody.innerHTML='';}
function openProfile(){
  openModal('Profil',`<div class="stat-grid"><div class="stat"><small>DARAJA</small><b>${levelInfo().level}</b></div><div class="stat"><small>XP</small><b>${profile.xp}</b></div><div class="stat"><small>G‘ALABA</small><b>${profile.wins}</b></div><div class="stat"><small>KOLLEKSIYA</small><b>${Object.keys(profile.collection).length}</b></div></div><p class="section-note">Profil ismini o‘zgartirish:</p><div class="collection-tools"><input id="profileNameInput" maxlength="20" value="${escapeHtml(profile.name)}"><button id="saveNameBtn" class="primary">SAQLASH</button></div>`);
  $('saveNameBtn').onclick=()=>{const v=$('profileNameInput').value.trim().slice(0,20);if(v){profile.name=v;saveProfile();flashToast('Profil saqlandi');closeModal();}};
}
function openCareer(){
  const cards=DATA.careers.map((c,i)=>{const unlocked=profile.xp>=c.need;const completed=profile.careerCompleted>i;return `<button class="feature-card ${unlocked?'':'locked'}" data-career="${i}" ${unlocked?'':'disabled'}><div class="ico">${completed?'✅':unlocked?'🎯':'🔒'}</div><b>${i+1}. ${c.title}</b><small>${c.difficulty.toUpperCase()} • ${c.category==='all'?'Barcha kategoriya':c.category} • ${c.rounds} raund</small><small>Ochish: ${c.need} XP • Mukofot: 🪙 ${c.reward}</small></button>`}).join('');
  openModal('Karyera',`<p class="section-note">XP yig‘ib yangi bosqichlarni oching. Har bosqich bir marta katta mukofot beradi.</p><div class="card-grid">${cards}</div>`);
  els.modalBody.querySelectorAll('[data-career]').forEach(b=>b.onclick=()=>{const i=+b.dataset.career;closeModal();startMode('career',{careerIndex:i});});
}
function openModes(){
  const modes=[
    ['survival','❤️','SURVIVAL','Bitta xato — o‘yin tugaydi'],['blitz','🚀','60 SONIYALIK BLITZ','1 daqiqada rekord o‘rnating'],['choice','🔢','4 TA VARIANT','Javobni variantlardan tanlang'],['description','🧩','TA’RIFDAN TOP','Rasmsiz ma’lumotdan brendni toping'],
    ['crop','🔍','LOGO QISMLARI','Faqat logoning bir qismi'],['category','🗂️','KATEGORIYA','Bir sohani tanlab o‘ynang'],['color','🎨','RANGNI TOPISH','Logoning asl rangini toping'],
    ['history','🕰️','LOGO TARIXI','Brend va tarix mini-testi'],['oldnew','🔄','ESKI VS YANGI','Rebrend va eski/yangi belgilar'],['mystery','🎲','MYSTERY','Har raund boshqa qoida'],['risk','💰','RISK x2','100 tanga tikib x2 mukofot'],
    ['tournament','🏆','TURNIR','3 bosqich, kuchayib boruvchi bot'],['twoPlayer','👥','2 O‘YINCHI','Bitta PCda navbat bilan'],['custom','🛠️','CUSTOM MATCH','Qoidalarni o‘zingiz tanlang']
  ];
  openModal('O‘yin rejimlari',`<div class="card-grid">${modes.map(m=>`<button class="feature-card" data-mode="${m[0]}"><div class="ico">${m[1]}</div><b>${m[2]}</b><small>${m[3]}</small></button>`).join('')}</div>`);
  els.modalBody.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>selectModeFromModal(b.dataset.mode));
}
function selectModeFromModal(mode){
  if(mode==='category'){openCategoryPicker();return;} if(mode==='custom'){openCustom();return;}
  if(mode==='risk' && profile.coins<100){flashToast('Risk uchun kamida 100 tanga kerak');return;}
  closeModal(); startMode(mode,{});
}
function openCategoryPicker(){
  const cats=[...new Set(BRANDS.map(b=>b.category))].sort();
  openModal('Kategoriya rejimi',`<p class="section-note">Qaysi sohadagi brendlarni topmoqchisiz?</p><div class="card-grid">${cats.map(c=>`<button class="feature-card" data-cat="${escapeHtml(c)}"><div class="ico">📁</div><b>${escapeHtml(c)}</b><small>${BRANDS.filter(b=>b.category===c).length} ta brend</small></button>`).join('')}</div>`);
  els.modalBody.querySelectorAll('[data-cat]').forEach(b=>b.onclick=()=>{const c=b.dataset.cat;closeModal();startMode('category',{category:c});});
}
function openCustom(){
  const cats=['all',...[...new Set(BRANDS.map(b=>b.category))].sort()];
  openModal('Custom Match',`<div class="custom-grid">
    <label class="setting">Raund <input id="cRounds" type="number" min="5" max="30" value="10"></label>
    <label class="setting">Qiyinchilik <select id="cDiff"><option value="easy">Oson</option><option value="medium">O‘rtacha</option><option value="hard">Qiyin</option></select></label>
    <label class="setting">Kategoriya <select id="cCat">${cats.map(c=>`<option value="${escapeHtml(c)}">${c==='all'?'Barchasi':escapeHtml(c)}</option>`).join('')}</select></label>
    <label class="setting">Javob turi <select id="cChoice"><option value="text">Yozish</option><option value="choice">4 variant</option></select></label>
    <label class="setting">Boss raund <input id="cBoss" type="checkbox" checked></label><label class="setting">Bot <input id="cBot" type="checkbox" checked></label>
  </div><button id="customStart" class="primary" style="width:100%;margin-top:12px">CUSTOM O‘YINNI BOSHLASH</button>`);
  $('cDiff').value=difficulty;$('customStart').onclick=()=>{const opts={rounds:clamp(+$('cRounds').value||10,5,30),difficulty:$('cDiff').value,category:$('cCat').value,choice:$('cChoice').value==='choice',boss:$('cBoss').checked,bot:$('cBot').checked};closeModal();startMode('custom',opts);};
}
function openCollection(){
  const cats=['all',...[...new Set(BRANDS.map(b=>b.category))].sort()];
  openModal('Brend kolleksiyasi',`<div class="collection-tools"><input id="collectionSearch" placeholder="Brend qidirish..."><select id="collectionCat">${cats.map(c=>`<option value="${escapeHtml(c)}">${c==='all'?'Barcha kategoriya':escapeHtml(c)}</option>`).join('')}</select></div><div id="collectionGrid" class="collection-grid"></div>`);
  const render=()=>{const q=normalize($('collectionSearch').value),cat=$('collectionCat').value;const list=BRANDS.filter(b=>(cat==='all'||b.category===cat)&&(!q||normalize(b.name).includes(q))).slice(0,160);$('collectionGrid').innerHTML=list.map(b=>{const found=!!profile.collection[b.name];return `<div class="collection-item ${found?'':'locked'}"><b>${found?escapeHtml(b.name):'???'}</b><small>${escapeHtml(b.category)}</small></div>`}).join('');};
  $('collectionSearch').oninput=render;$('collectionCat').onchange=render;render();
}
function openShop(){
  const html=DATA.shop.map(item=>{const owned=profile.owned.includes(item.id);const qty=item.type==='power'?profile.inventory[item.id.replace('p_','')]||0:'';const canXP=profile.xp>=item.needXP;return `<button class="feature-card ${canXP?'':'locked'}" data-shop="${item.id}" ${canXP?'':'disabled'}><div class="ico">${item.emoji}</div><b>${escapeHtml(item.name)} ${qty!==''?`×${qty}`:''}</b><small>${item.needXP?`${item.needXP} XP talab`:'Darhol mavjud'}${owned?' • SIZDA BOR':''}</small><div class="price">🪙 ${owned&&item.type!=='power'?'JIHOZLASH':item.cost}</div></button>`}).join('');
  openModal('XP Do‘koni',`<p class="section-note">XP yangi buyumlarni ochadi, tanga esa sotib olish uchun ishlatiladi. Power-up’larni qayta-qayta olish mumkin.</p><div class="card-grid">${html}</div>`);
  els.modalBody.querySelectorAll('[data-shop]').forEach(b=>b.onclick=()=>buyShop(b.dataset.shop));
}
function buyShop(id){
  const item=DATA.shop.find(x=>x.id===id);if(!item)return;if(profile.xp<item.needXP){flashToast('XP yetarli emas');return;}
  const owned=profile.owned.includes(id);
  if(owned&&item.type!=='power'){equipItem(item);openShop();return;}
  if(profile.coins<item.cost){flashToast('Tanga yetarli emas');return;}
  profile.coins-=item.cost;
  if(item.type==='power'){const key=id.replace('p_','');profile.inventory[key]=(profile.inventory[key]||0)+(item.qty||1);}
  else{profile.owned.push(id);equipItem(item,false);}
  saveProfile();sfx('buy');flashToast(`${item.name} olindi`);openShop();
}
function equipItem(item,save=true){
  if(item.type==='background')profile.equipped.background=item.id;
  if(item.type==='avatar')profile.equipped.avatar=item.id;
  if(item.type==='frame')profile.equipped.frame=item.id;
  applySettings();if(save)saveProfile();
}
function openMissions(){
  const d=profile.daily.progress;const missions=[['play','3 ta o‘yin o‘ynang',d.play,3,100],['correct','15 ta to‘g‘ri javob bering',d.correct,15,150],['streak','5 streakga chiqing',d.streak,5,200]];
  openModal('Kunlik vazifalar',missions.map(m=>`<div class="mission"><div class="mission-head"><b>${m[1]}</b><span>🪙 ${m[4]} ${profile.daily.claimed[m[0]]?'✅':''}</span></div><div class="progress-line"><i style="width:${Math.min(100,m[2]/m[3]*100)}%"></i></div><small>${Math.min(m[2],m[3])} / ${m[3]}</small></div>`).join('')+`<p class="section-note">Vazifa bajarilganda mukofot avtomatik beriladi. Vazifalar har kuni yangilanadi.</p>`);
}
function openAchievements(){
  openModal('Yutuqlar',`<div class="card-grid">${DATA.achievements.map(a=>`<div class="feature-card achievement ${profile.achievements[a.id]?'unlocked':''}"><div class="ico">${profile.achievements[a.id]?a.icon:'🔒'}</div><b>${escapeHtml(a.name)}</b><small>${escapeHtml(a.desc)}</small></div>`).join('')}</div>`);
}
function openStats(){
  const acc=profile.correct+profile.wrong?Math.round(profile.correct/(profile.correct+profile.wrong)*100):0;
  const catRows=Object.entries(profile.categoryStats).sort((a,b)=>(b[1].correct||0)-(a[1].correct||0)).slice(0,8).map(([c,s])=>`<div class="leader-row"><span>•</span><b>${escapeHtml(c)}</b><span>${s.correct||0}/${(s.correct||0)+(s.wrong||0)}</span></div>`).join('');
  openModal('Statistika',`<div class="stat-grid"><div class="stat"><small>O‘YINLAR</small><b>${profile.games}</b></div><div class="stat"><small>G‘ALABA</small><b>${profile.wins}</b></div><div class="stat"><small>ANIQLIK</small><b>${acc}%</b></div><div class="stat"><small>BEST STREAK</small><b>${profile.bestStreak}</b></div><div class="stat"><small>BLITZ</small><b>${profile.bestBlitz}</b></div><div class="stat"><small>SURVIVAL</small><b>${profile.bestSurvival}</b></div><div class="stat"><small>ENG TEZ</small><b>${profile.bestSpeed<99?profile.bestSpeed.toFixed(2)+'s':'—'}</b></div><div class="stat"><small>TOPILGAN</small><b>${Object.keys(profile.collection).length}</b></div></div><h3>Kategoriya natijalari</h3><div class="leaderboard">${catRows||'<p class="section-note">Hali statistika yo‘q.</p>'}</div>`);
}
function openLeaderboard(){
  const seed=hashString(profile.weekly.key);const bots=['LogoBot','Mahalla AI','Brendchi','Tezkor','Pixel Usta'];const rows=bots.map((n,i)=>({name:n,score:650+((seed*(i+7)*31)%1250)}));rows.push({name:profile.name+' (Siz)',score:profile.weekly.best,me:true});rows.sort((a,b)=>b.score-a.score);
  openModal('Haftalik mahalliy reyting',`<p class="section-note">Internet leaderboard emas — shu kompyuterdagi haftalik rekord va simulyatsiya raqiblari.</p><div class="leaderboard">${rows.map((r,i)=>`<div class="leader-row ${r.me?'me':''}"><b>${i+1}</b><span>${escapeHtml(r.name)}</span><b>${r.score}</b></div>`).join('')}</div>`);
}
function hashString(s){let h=2166136261;for(const ch of s){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}return Math.abs(h>>>0)}
function openSettings(){
  openModal('Sozlamalar',`<div class="settings-grid">
    <label class="setting">Yengil rejim <input id="setLite" type="checkbox" ${profile.settings.lite?'checked':''}></label>
    <label class="setting">Ovoz effektlari <input id="setSfx" type="checkbox" ${profile.settings.sfx?'checked':''}></label>
    <label class="setting">Fon musiqasi <input id="setMusic" type="checkbox" ${profile.settings.music?'checked':''}></label>
    <label class="setting">Yorug‘ tema <input id="setLight" type="checkbox" ${profile.settings.theme==='light'?'checked':''}></label>
  </div><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px"><button id="fullBtn" class="secondary">⛶ TO‘LIQ EKRAN</button><button id="clearCacheBtn" class="secondary">🧹 LOGO KESHNI TOZALASH</button></div><p class="section-note">Save ma’lumotlari brauzer profilida saqlanadi. Keshni tozalash XP yoki progressni o‘chirmaydi.</p>`);
  $('setLite').onchange=e=>{profile.settings.lite=e.target.checked;applySettings();saveProfile();};
  $('setSfx').onchange=e=>{profile.settings.sfx=e.target.checked;saveProfile();};
  $('setMusic').onchange=e=>{profile.settings.music=e.target.checked;e.target.checked?startMusic():stopMusic();saveProfile();};
  $('setLight').onchange=e=>{profile.settings.theme=e.target.checked?'light':'dark';applySettings();saveProfile();};
  $('fullBtn').onclick=toggleFullscreen;$('clearCacheBtn').onclick=async()=>{await clearLogoDB();flashToast('Logo keshi tozalandi');};
}
function toggleFullscreen(){try{if(!document.fullscreenElement)document.documentElement.requestFullscreen?.();else document.exitFullscreen?.();}catch(_){}}

function modeConfig(mode,opts={}){
  const cfg={mode,rounds:10,difficulty:difficulty,category:'all',bot:true,choice:false,boss:true,totalSeconds:0,label:'KLASSIK'};
  if(mode==='survival')Object.assign(cfg,{rounds:50,difficulty:'medium',bot:false,boss:false,label:'SURVIVAL'});
  if(mode==='blitz')Object.assign(cfg,{rounds:999,difficulty:'easy',bot:false,boss:false,totalSeconds:60,label:'60 SONIYA BLITZ'});
  if(mode==='choice')Object.assign(cfg,{choice:true,label:'4 TA VARIANT'});
  if(mode==='description')Object.assign(cfg,{choice:true,boss:false,label:'TA’RIFDAN TOP'});
  if(mode==='crop')Object.assign(cfg,{difficulty:'hard',label:'LOGO QISMLARI'});
  if(mode==='category')Object.assign(cfg,{category:opts.category||'Texnologiya',label:`KATEGORIYA • ${opts.category||'Texnologiya'}`});
  if(mode==='color')Object.assign(cfg,{choice:true,bot:false,boss:false,label:'RANGNI TOPISH'});
  if(mode==='history')Object.assign(cfg,{choice:true,bot:false,boss:false,label:'LOGO TARIXI'});
  if(mode==='oldnew')Object.assign(cfg,{choice:true,bot:false,boss:false,label:'ESKI / YANGI LOGO'});
  if(mode==='mystery')Object.assign(cfg,{label:'MYSTERY',rounds:10});
  if(mode==='risk')Object.assign(cfg,{label:'RISK x2'});
  if(mode==='tournament')Object.assign(cfg,{label:'TURNIR • CHORAK FINAL',rounds:15,difficulty:'medium'});
  if(mode==='twoPlayer')Object.assign(cfg,{label:'2 O‘YINCHI',rounds:10,bot:false,boss:false});
  if(mode==='career'){const c=DATA.careers[opts.careerIndex||0];Object.assign(cfg,{label:`KARYERA • ${c.title}`,rounds:c.rounds,difficulty:c.difficulty,category:c.category,careerIndex:opts.careerIndex||0,rare:(opts.careerIndex||0)>=5});}
  if(mode==='custom')Object.assign(cfg,{label:'CUSTOM MATCH',rounds:opts.rounds||10,difficulty:opts.difficulty||difficulty,category:opts.category||'all',choice:!!opts.choice,bot:opts.bot!==false,boss:opts.boss!==false});
  return cfg;
}
function startMode(mode,opts={}){
  cleanupGame();closeModal();
  const cfg=modeConfig(mode,opts);lastModeSpec={mode,opts:{...opts}};difficulty=cfg.difficulty;
  if(mode==='risk'){profile.coins-=100;saveProfile();}
  let pool=BRANDS;
  if(cfg.category!=='all')pool=pool.filter(b=>b.category===cfg.category);
  if(cfg.rare){const cut=Math.floor(BRANDS.length*.65);const expert=pool.filter(b=>BRANDS.indexOf(b)>=cut);if(expert.length>=20)pool=expert;}
  if(mode==='color')pool=pool.filter(b=>DATA.brandColors[b.name]);
  const bot=DATA.botPersonalities.find(b=>b.id===botId)||DATA.botPersonalities[1];
  state={cfg,queue:shuffle(pool),reserve:shuffle(pool),used:new Set(),round:0,playerScore:0,botScore:0,history:[],roundEnded:false,paused:false,loading:false,stopped:false,
    current:null,maxTime:LEVELS[cfg.difficulty].time,roundStartedAt:0,roundEndAt:0,globalEndAt:0,botAt:0,botStage:'idle',botWrongUsed:false,nextRoundAt:0,
    streak:0,bestStreak:0,xpGain:0,coinGain:0,hints:{letter:2,category:2,time:1},shieldActive:false,boss:false,risk:mode==='risk',lastFact:'',
    bot,choiceOptions:[],survivalCorrect:0,blitzCorrect:0,twoActive:1,tournamentStage:0,stagePlayer:0,stageBot:0,careerRewarded:false,banked:false,logoFailCount:0};
  if(cfg.totalSeconds)state.globalEndAt=performance.now()+cfg.totalSeconds*1000;
  setupGameUI();showScreen(els.gameScreen);trackDaily('play',1);profile.games++;saveProfile();nextRound();
}
function setupGameUI(){
  const av=AVATARS[profile.equipped.avatar]||'🙂';els.playerAvatar.textContent=av;els.playerLabel.textContent=state.cfg.mode==='twoPlayer'?'O‘YINCHI 1':'SIZ';
  els.botEmoji.textContent=state.cfg.mode==='twoPlayer'?'🧑':state.bot.emoji;els.botName.textContent=state.cfg.mode==='twoPlayer'?'O‘YINCHI 2':state.cfg.bot?state.bot.name:'REKORD';els.botFace.textContent=els.botEmoji.textContent;
  els.playerScore.textContent='0';els.botScore.textContent='0';els.streakValue.textContent='0';els.xpGainValue.textContent='0';els.coinGainValue.textContent='0';els.modeLabel.textContent=state.cfg.label;
  els.riskBadge.classList.toggle('hidden',!state.risk);els.bossBadge.classList.add('hidden');els.botBubble.classList.add('hidden');updatePowerButtons();updateHints();renderHistory();hideAnswerReveal();
}


function hideAnswerReveal(){
  els.answerReveal.classList.add('hidden');
  els.answerReveal.classList.remove('good','bad');
  els.answerRevealKicker.textContent='TO‘G‘RI JAVOB';
  els.answerRevealName.textContent='—';
  els.answerRevealNote.textContent='';
  els.answerRevealVisual.classList.add('hidden');
  els.answerRevealImg.removeAttribute('src');
}

async function showAnswerReveal(brand, status='miss', reasonText=''){
  if(!brand) return;
  const success = status==='success';
  els.answerReveal.classList.remove('hidden','good','bad');
  els.answerReveal.classList.add(success?'good':'bad');
  els.answerRevealKicker.textContent = success ? '✅ TO‘G‘RI TOPDINGIZ' : '❌ TOPA OLMADINGIZ';
  els.answerRevealName.textContent = brand.name || '—';
  els.answerRevealNote.textContent = reasonText || (success ? 'Bu brendni to‘g‘ri topdingiz.' : 'Bu safar to‘g‘ri javob shu edi.');
  els.answerRevealVisual.classList.add('hidden');
  els.answerRevealImg.removeAttribute('src');

  if(state && state.cfg.mode!=='description' && !els.logoViewport.classList.contains('hidden') && els.brandLogo.src){
    els.answerRevealImg.src = els.brandLogo.src;
    els.answerRevealVisual.classList.remove('hidden');
    return;
  }

  const src = await getRevealLogoSrc(brand);
  if(src){
    els.answerRevealImg.src = src;
    els.answerRevealVisual.classList.remove('hidden');
  } else {
    els.answerRevealNote.textContent = (reasonText ? reasonText + ' • ' : '') + 'Rasm topilmadi, lekin brend nomi ko‘rsatildi.';
  }
}

async function getRevealLogoSrc(brand){
  try{
    const cached = await idbGet('logo:v3:'+brand.name).catch(()=>null);
    if(cached && cached.data) return cached.data;
  }catch(_){ }
  for(const c of logoCandidates(brand)){
    try{
      if(c.kind==='svg'){
        const text = await fetchText(c.url, 1800);
        if(text && text.includes('<svg') && text.length < 350000){
          const fixed = await normalizeSvgVisualBounds(text);
          const data = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(fixed || text);
          idbPut('logo:v3:'+brand.name,{data,kind:'svg',at:Date.now()}).catch(()=>{});
          return data;
        }
      } else {
        const ok = await imageLoads(c.url, 1800);
        if(ok) return c.url;
      }
    }catch(_){ }
  }
  return '';
}

function imageLoads(url, timeout=1800){
  return new Promise(resolve=>{
    const img = new Image();
    let done = false;
    const finish = v => { if(done) return; done = true; clearTimeout(timer); img.onload = img.onerror = null; resolve(v); };
    const timer = setTimeout(()=>finish(false), timeout);
    img.onload = ()=>finish(true);
    img.onerror = ()=>finish(false);
    img.referrerPolicy='no-referrer';
    img.decoding='async';
    img.src = url;
  });
}

async function nextRound(){
  if(!state||state.stopped)return;
  if(state.cfg.mode==='blitz' && performance.now()>=state.globalEndAt){endGame('complete');return;}
  if(state.round>=state.cfg.rounds){endGame('complete');return;}
  if(state.cfg.mode==='tournament' && state.round>0 && state.round%5===0){if(!resolveTournamentStage())return;}
  const token=++roundToken;state.roundEnded=false;state.loading=true;state.botWrongUsed=false;state.choiceOptions=[];state.boss=state.cfg.boss&&state.round>0&&(state.round+1)%5===0;
  els.bossBadge.classList.toggle('hidden',!state.boss);els.roundLabel.textContent=state.cfg.mode==='blitz'?`${state.blitzCorrect} TOPILDI`:`${state.round+1} / ${state.cfg.rounds}`;
  els.feedback.className='feedback neutral';els.feedback.textContent=state.cfg.mode==='twoPlayer'?`${state.twoActive}-o‘yinchi navbati`:state.boss?'👹 BOSS RAUND — mukofot x2!':'Savol tayyorlanmoqda...';els.hintText.textContent='Yordamlar shu yerda ko‘rinadi.';els.answerInput.value='';els.answerInput.disabled=true;els.submitBtn.disabled=true;els.choiceGrid.innerHTML='';els.choiceGrid.classList.add('hidden');els.answerForm.classList.remove('hidden');hideAnswerReveal();
  els.botBubble.classList.add('hidden');els.botStatus.textContent=state.cfg.bot?'Bot kutmoqda...':'Rekord rejimi';resetLogoTransform();
  if(state.cfg.mode==='history'||state.cfg.mode==='oldnew'){prepareHistoryQuestion();beginRoundClock();return;}
  if(state.cfg.mode==='description'){prepareDescriptionQuestion();beginRoundClock();return;}
  const ok=await chooseAndLoadBrand(token);if(!state||token!==roundToken)return;
  if(!ok){state.logoFailCount=(state.logoFailCount||0)+1;els.feedback.className='feedback bad';if(state.logoFailCount>=3){els.feedback.textContent='Internet yoki logo serverlari ishlamayapti. “Qayta yuklash”ni bosing.';els.retryLogoBtn.classList.remove('hidden');els.sourceText.textContent='Logo ulanishi kutilmoqda';}else{els.feedback.textContent='Logo topilmadi. Boshqa brendga o‘tyapman...';setTimeout(()=>{if(state&&!state.stopped)nextRound();},650);}return;}
  state.logoFailCount=0;
  prepareQuestionUI();beginRoundClock();prefetchNext();
}
function resolveTournamentStage(){
  if(state.stagePlayer<=state.stageBot){state.lastFact='Turnir bosqichida BOT ko‘proq ochko oldi.';endGame('tournament_loss');return false;}
  state.tournamentStage++;state.stagePlayer=0;state.stageBot=0;
  const bots=['hazilkash','professional','chempion'];const id=bots[Math.min(state.tournamentStage,2)];state.bot=DATA.botPersonalities.find(b=>b.id===id)||state.bot;
  const names=['YARIM FINAL','FINAL','FINAL'];state.cfg.label=`TURNIR • ${names[Math.min(state.tournamentStage,2)]}`;els.modeLabel.textContent=state.cfg.label;els.botName.textContent=state.bot.name;els.botEmoji.textContent=state.bot.emoji;els.botFace.textContent=state.bot.emoji;flashToast(`🏆 ${names[Math.min(state.tournamentStage,2)]} boshlandi`);return true;
}
async function chooseAndLoadBrand(token){
  for(let tries=0;tries<18;tries++){
    let b=state.queue.shift();if(!b){state.queue=shuffle(state.reserve.length?state.reserve:BRANDS);b=state.queue.shift();}
    if(!b)break;if(state.used.has(b.name)&&state.used.size<Math.min(100,state.reserve.length))continue;
    if(state.cfg.mode==='color'&&!DATA.brandColors[b.name])continue;
    state.current=b;const ok=await loadLogo(b,token);if(ok){state.used.add(b.name);return true;}
  }return false;
}
function prepareQuestionUI(){
  els.textQuestion.classList.add('hidden');els.logoViewport.classList.remove('hidden');els.questionTitle.textContent=state.cfg.mode==='color'?'Bu logoning asosiy rangi qaysi?':'Bu qaysi brend?';
  applyDifficultyTransform();
  if(state.cfg.mode==='color'){els.brandLogo.style.filter='grayscale(1) contrast(1.1)';buildColorChoices();return;}
  if(state.cfg.choice){buildBrandChoices();return;}
  els.answerForm.classList.remove('hidden');els.choiceGrid.classList.add('hidden');
}
function prepareDescriptionQuestion(){
  const descriptions=DATA.brandDescriptions||{};
  let b=null;
  for(let tries=0;tries<Math.max(12,state.reserve.length);tries++){
    const candidate=state.queue.shift();
    if(!candidate){state.queue=shuffle(state.reserve.length?state.reserve:BRANDS);continue;}
    if(state.used.has(candidate.name)&&state.used.size<Math.min(100,state.reserve.length))continue;
    if(!descriptions[candidate.name])continue;
    b=candidate;break;
  }
  if(!b){
    const pool=BRANDS.filter(x=>descriptions[x.name]);
    b=pool[Math.floor(Math.random()*pool.length)];
  }
  state.current=b;state.used.add(b.name);state.loading=false;
  els.logoLoading.classList.add('hidden');els.logoViewport.classList.add('hidden');els.fallbackLogo.classList.add('hidden');
  els.qualityBadge.textContent='RASM YO‘Q';els.textQuestion.classList.remove('hidden');
  const lines=Array.isArray(descriptions[b.name])?descriptions[b.name]:[String(descriptions[b.name]||'')];
  els.textQuestion.innerHTML=`<div class="description-question"><div class="description-icon">🧩</div><div class="description-kicker">ISHORALARNI O‘QING</div>${lines.map((x,i)=>`<div class="description-clue"><b>${i+1}</b><span>${escapeHtml(x)}</span></div>`).join('')}<small>Brend nomi matnda yashirilgan. To‘g‘ri variantni tanlang.</small><div class="description-time-note">⏱ O‘qish vaqti: ${DESCRIPTION_LEVELS[state.cfg.difficulty].time} soniya</div></div>`;
  els.questionTitle.textContent='Qaysi brend haqida gap ketmoqda?';
  els.sourceText.textContent='Rasm ishlatilmaydi • faqat ta’rif';
  els.sourceText.parentElement.classList.remove('ok','fail');
  els.retryLogoBtn.classList.add('hidden');
  buildBrandChoices();
}
function prepareHistoryQuestion(){
  const q=(state.cfg.mode==='oldnew'?(DATA.oldNewQuestions||DATA.historyQuestions):DATA.historyQuestions)[state.round%((state.cfg.mode==='oldnew'?(DATA.oldNewQuestions||DATA.historyQuestions):DATA.historyQuestions).length)];state.current={name:q.a,domain:'',slug:'',category:'Tarix',history:q};
  els.logoLoading.classList.add('hidden');els.logoViewport.classList.add('hidden');els.fallbackLogo.classList.add('hidden');els.qualityBadge.textContent='TARIX';els.textQuestion.classList.remove('hidden');els.textQuestion.textContent=q.q;els.questionTitle.textContent=state.cfg.mode==='oldnew'?'Eski yoki yangi logo?':'Brend tarixi savoli';buildChoices(q.choices,q.a);state.loading=false;
}
function buildBrandChoices(){
  const correct=state.current.name;const same=BRANDS.filter(b=>b.name!==correct&&b.category===state.current.category);const rest=BRANDS.filter(b=>b.name!==correct);const wrong=shuffle(same.length>=3?same:rest).slice(0,3).map(b=>b.name);buildChoices(shuffle([correct,...wrong]),correct);
}
function buildColorChoices(){
  const correct=DATA.brandColors[state.current.name];const palette=['#e50914','#005cb9','#1ed760','#ffd100','#111111','#9146ff','#ff9900','#25d366'].filter(c=>c!==correct);const vals=shuffle([correct,...shuffle(palette).slice(0,3)]);state.choiceOptions=vals;els.answerForm.classList.add('hidden');els.choiceGrid.classList.remove('hidden');els.choiceGrid.innerHTML=vals.map(v=>`<button data-choice="${v}"><span style="display:inline-block;width:18px;height:18px;border-radius:50%;background:${v};vertical-align:middle;margin-right:7px;border:1px solid #777"></span>${v.toUpperCase()}</button>`).join('');els.choiceGrid.querySelectorAll('button').forEach(b=>b.onclick=()=>submitChoice(b.dataset.choice,correct));
}
function buildChoices(values,correct){
  state.choiceOptions=[...values];els.answerForm.classList.add('hidden');els.choiceGrid.classList.remove('hidden');els.choiceGrid.innerHTML=values.map(v=>`<button data-choice="${escapeHtml(v)}">${escapeHtml(v)}</button>`).join('');els.choiceGrid.querySelectorAll('button').forEach(b=>b.onclick=()=>submitChoice(b.dataset.choice,correct));
}
function beginRoundClock(){
  if(!state)return;
  const now=performance.now(),cfg=LEVELS[state.cfg.difficulty];
  const clockCfg=state.cfg.mode==='description'?DESCRIPTION_LEVELS[state.cfg.difficulty]:cfg;
  state.loading=false;state.maxTime=clockCfg.time;
  if(state.cfg.mode==='survival')state.maxTime=8;
  if(state.cfg.mode==='blitz'){state.roundStartedAt=now;state.roundEndAt=state.globalEndAt;}
  else{state.roundStartedAt=now;state.roundEndAt=now+state.maxTime*1000;}
  if(state.cfg.bot){
    let speed=state.bot.speed*(state.boss?.68:1);
    state.botAt=now+(clockCfg.botMin+Math.random()*(clockCfg.botMax-clockCfg.botMin))*speed*1000;
    state.botStage='thinking';
    els.botStatus.textContent=state.cfg.mode==='description'?'Bot ishoralarni o‘qimoqda...':randomBotLine();
  }else state.botAt=Infinity;
  els.answerInput.disabled=false;els.submitBtn.disabled=false;if(!els.answerForm.classList.contains('hidden'))els.answerInput.focus();updateTimer(now);startLoop();
}
function startLoop(){cancelAnimationFrame(rafId);rafId=requestAnimationFrame(gameLoop)}
function gameLoop(now){
  if(!state||state.stopped||state.paused)return;updateTimer(now);if(state.cfg.bot&&!state.roundEnded)updateBot(now);
  if(!state.roundEnded){const deadline=state.cfg.mode==='blitz'?state.globalEndAt:state.roundEndAt;if(now>=deadline){if(state.cfg.mode==='blitz'){endGame('complete');return;}onTimeout();}}
  if(state&&state.roundEnded&&state.nextRoundAt&&now>=state.nextRoundAt){state.nextRoundAt=0;state.round++;nextRound();return;}
  rafId=requestAnimationFrame(gameLoop);
}
function updateTimer(now){
  if(!state)return;const end=state.cfg.mode==='blitz'?state.globalEndAt:state.roundEndAt;const total=state.cfg.mode==='blitz'?state.cfg.totalSeconds:state.maxTime;const left=Math.max(0,(end-now)/1000);els.timerText.textContent=left.toFixed(left<10?1:0);els.timerBar.style.width=`${clamp(left/total,0,1)*100}%`;
}
function updateBot(now){
  if(state.botStage==='thinking' && now>=state.botAt-650){state.botStage='typing';els.botStatus.textContent='Bot javob yozmoqda...';}
  if(now<state.botAt||state.roundEnded)return;
  const cfg=LEVELS[state.cfg.difficulty];const acc=clamp(cfg.accuracy+state.bot.accuracy+(state.boss?.04:0),.35,.995);
  if(Math.random()<acc||state.botWrongUsed){els.botBubble.textContent=state.current.name;els.botBubble.classList.remove('hidden');sfx('bot');finishRound('bot',`🤖 ${state.bot.name} tezroq topdi: ${state.current.name}`);}
  else{state.botWrongUsed=true;const wrong=pickWrongBrand(state.current.name);els.botBubble.textContent=wrong;els.botBubble.classList.remove('hidden');els.botStatus.textContent='Bot xato qildi, yana o‘ylayapti...';state.botAt=now+rand(900,1700);state.botStage='thinking';}
}
function submitTextAnswer(){
  if(!state||state.paused||state.roundEnded||state.loading)return;const val=els.answerInput.value.trim();if(!val)return;
  if(isCorrect(val,state.current.name)){const t=(performance.now()-state.roundStartedAt)/1000;profile.bestSpeed=Math.min(profile.bestSpeed,t);finishRound('player',`✓ TO‘G‘RI! ${state.current.name}`);}
  else{stateWrongAttempt();els.feedback.className='feedback bad';els.feedback.textContent='✕ Noto‘g‘ri. Yana urinib ko‘ring!';els.answerInput.select();sfx('bad');if(state.cfg.mode==='survival'){state.lastFact=`To‘g‘ri javob: ${state.current.name}`;endGame('survival_fail');}else if(state.cfg.mode==='twoPlayer'){finishRound('none',`Noto‘g‘ri. Javob: ${state.current.name}`);}}
}
function submitChoice(value,correct){
  if(!state||state.roundEnded||state.paused)return;if(String(value)===String(correct)){const t=(performance.now()-state.roundStartedAt)/1000;profile.bestSpeed=Math.min(profile.bestSpeed,t);finishRound('player','✓ TO‘G‘RI!');}
  else{stateWrongAttempt();sfx('bad');if(state.cfg.mode==='survival'){endGame('survival_fail');return;}finishRound(state.cfg.bot?'bot':'none',`✕ Noto‘g‘ri. To‘g‘ri javob: ${correct}`);}
}
function stateWrongAttempt(){
  profile.wrong++;profile.totalRounds++;const cat=state.current?.category||'Boshqa';profile.categoryStats[cat]=profile.categoryStats[cat]||{correct:0,wrong:0};profile.categoryStats[cat].wrong++;
  if(state.shieldActive){state.shieldActive=false;flashToast('🛡️ Streak saqlandi');}else state.streak=0;els.streakValue.textContent=state.streak;
}
function onTimeout(){
  if(state.cfg.mode==='survival'){state.lastFact=`Vaqt tugadi. Javob: ${state.current.name}`;endGame('survival_fail');return;}
  if(state.cfg.mode==='twoPlayer'){finishRound('none',`Vaqt tugadi. Javob: ${state.current.name}`);return;}
  if(state.cfg.bot)finishRound('bot',`Vaqt tugadi. ${state.bot.name} ochko oldi.`);else finishRound('none',`Vaqt tugadi. Javob: ${state.current.name}`);
}
function finishRound(winner,message){
  if(!state||state.roundEnded)return;state.roundEnded=true;els.answerInput.disabled=true;els.submitBtn.disabled=true;els.choiceGrid.querySelectorAll('button').forEach(b=>b.disabled=true);revealLogo();
  const left=Math.max(0,(state.roundEndAt-performance.now())/1000);let gainXP=0,gainCoins=0;
  if(winner==='player'){
    state.playerScore++;if(state.cfg.mode==='twoPlayer'&&state.twoActive===2){state.playerScore--;state.botScore++;} // active player 2 uses right score
    state.streak++;state.bestStreak=Math.max(state.bestStreak,state.streak);profile.bestStreak=Math.max(profile.bestStreak,state.streak);
    const base=55+Math.round(left*5);let mult=LEVELS[state.cfg.difficulty].mult;if(state.boss)mult*=2;if(state.cfg.mode==='mystery')mult*=1.5;if(state.risk)mult*=2;
    gainXP=Math.round(base*mult);gainCoins=Math.max(8,Math.round(gainXP/8));state.xpGain+=gainXP;state.coinGain+=gainCoins;
    profile.correct++;profile.totalRounds++;trackDaily('correct',1);trackDaily('streak',state.streak,true);
    const cat=state.current?.category||'Boshqa';profile.categoryStats[cat]=profile.categoryStats[cat]||{correct:0,wrong:0};profile.categoryStats[cat].correct++;
    if(state.current?.domain){profile.collection[state.current.name]=true;}
    if(state.cfg.mode==='survival')state.survivalCorrect++;if(state.cfg.mode==='blitz')state.blitzCorrect++;
    if(state.boss)unlockAchievement('boss');if((performance.now()-state.roundStartedAt)<1500)unlockAchievement('speed');if(state.streak>=3)unlockAchievement('streak3');if(state.streak>=10)unlockAchievement('streak10');
    sfx('good');
  }else if(winner==='bot'){
    state.botScore++;if(state.cfg.mode==='tournament')state.stageBot++;state.streak=state.shieldActive?state.streak:0;state.shieldActive=false;profile.wrong++;profile.totalRounds++;
  }
  if(winner==='player'&&state.cfg.mode==='tournament')state.stagePlayer++;
  if(state.cfg.mode==='twoPlayer'){if(winner==='player'&&state.twoActive===2){} state.twoActive=state.twoActive===1?2:1;}
  els.playerScore.textContent=state.playerScore;els.botScore.textContent=state.botScore;els.streakValue.textContent=state.streak;els.xpGainValue.textContent=state.xpGain;els.coinGainValue.textContent=state.coinGain;
  els.feedback.className=`feedback ${winner==='player'?'good':winner==='bot'?'bad':'neutral'}`;els.feedback.textContent=message;state.lastFact=factFor(state.current);renderHistory(winner);checkAchievements();saveProfile();
  const isSuccess = winner==='player';
  const revealNote = isSuccess
    ? 'Ajoyib! Siz bu brendni to‘g‘ri topdingiz.'
    : (winner==='bot' ? 'Bu safar siz topa olmadingiz. To‘g‘ri javob shu edi.' : 'Vaqt tugadi yoki javob topilmadi. To‘g‘ri javob shu edi.');
  showAnswerReveal(state.current, isSuccess?'success':'miss', revealNote);
  if(state.cfg.mode==='survival'&&winner!=='player'){endGame('survival_fail');return;}
  if(state.cfg.mode==='blitz'){state.round++;state.roundEnded=false;setTimeout(()=>{if(state&&!state.stopped)nextRound();},120);return;}
  state.nextRoundAt=performance.now()+2500;
}
function factFor(brand){if(!brand)return'';return DATA.facts[brand.name]||`${brand.name} — ${brand.category||'mashhur brend'} kategoriyasidagi tanilgan brend. Rasmiy domen: ${brand.domain||'—'}.`;}
function pickWrongBrand(correct){const arr=BRANDS.filter(b=>b.name!==correct);return arr[Math.floor(Math.random()*arr.length)].name;}

function useHint(kind){
  if(!state||state.roundEnded||state.paused||state.loading||state.hints[kind]<=0)return;
  state.hints[kind]--;
  if(kind==='letter')els.hintText.textContent=`Birinchi harf: ${String(state.current.name)[0].toUpperCase()}`;
  if(kind==='category')els.hintText.textContent=`Kategoriya: ${state.current.category||'Tarix'}`;
  if(kind==='time'&&state.cfg.mode!=='blitz'){state.roundEndAt+=3000;state.maxTime+=3;els.hintText.textContent='⏱️ +3 soniya qo‘shildi';}
  updateHints();sfx('tick');
}
function updateHints(){if(!state)return;els.hintLetterCount.textContent=state.hints.letter;els.hintCategoryCount.textContent=state.hints.category;els.hintTimeCount.textContent=state.hints.time;[els.hintLetterBtn,els.hintCategoryBtn,els.hintTimeBtn].forEach((b,i)=>b.disabled=[state.hints.letter,state.hints.category,state.hints.time][i]<=0);}
function updatePowerButtons(){if(!state)return;const inv=profile.inventory;els.pFifty.textContent=inv.fifty||0;els.pFreeze.textContent=inv.freeze||0;els.pSlow.textContent=inv.slow||0;els.pReveal.textContent=inv.reveal||0;els.pShield.textContent=inv.shield||0;document.querySelectorAll('.powers button').forEach(b=>b.disabled=(inv[b.dataset.power]||0)<=0);}
function usePower(type){
  if(!state||state.roundEnded||state.paused||(profile.inventory[type]||0)<=0)return;
  let used=true;
  if(type==='fifty'){
    const buttons=[...els.choiceGrid.querySelectorAll('button:not(.eliminated)')];if(buttons.length>=4){const correct=state.cfg.mode==='color'?DATA.brandColors[state.current.name]:(state.cfg.mode==='history'?state.current.history.a:state.current.name);shuffle(buttons.filter(b=>b.dataset.choice!==String(correct))).slice(0,2).forEach(b=>b.classList.add('eliminated'));}
    else{els.hintText.textContent=`Ikki harf: ${String(state.current.name).slice(0,2).toUpperCase()}…`;}
  }else if(type==='freeze'){if(state.cfg.mode==='blitz')state.globalEndAt+=5000;else{state.roundEndAt+=5000;state.maxTime+=5;}state.botAt+=5000;flashToast('❄️ +5 soniya');}
  else if(type==='slow'){if(!state.cfg.bot){used=false;flashToast('Bu rejimda BOT yo‘q');}else{state.botAt+=3500;flashToast('🐌 Bot +3.5s sekinlashdi');}}
  else if(type==='reveal'){if(state.cfg.mode==='description'){els.hintText.textContent=`Qo‘shimcha ishora: kategoriya — ${state.current.category}`;flashToast('👁️ Qo‘shimcha ishora ochildi');}else{revealLogo();flashToast('👁️ Logo to‘liq ochildi');}}
  else if(type==='shield'){state.shieldActive=true;flashToast('🛡️ Keyingi xato streakni buzmaydi');}
  if(used){profile.inventory[type]--;saveProfile();updatePowerButtons();sfx('power');}
}

function pauseGame(){if(!state||state.paused)return;state.paused=true;state.pauseStarted=performance.now();cancelAnimationFrame(rafId);els.pauseOverlay.classList.remove('hidden');}
function resumeGame(){if(!state||!state.paused)return;const d=performance.now()-state.pauseStarted;state.paused=false;state.pauseStarted=0;if(state.cfg.mode==='blitz')state.globalEndAt+=d;else state.roundEndAt+=d;if(Number.isFinite(state.botAt))state.botAt+=d;if(state.nextRoundAt)state.nextRoundAt+=d;els.pauseOverlay.classList.add('hidden');startLoop();if(!state.roundEnded&&!els.answerForm.classList.contains('hidden'))els.answerInput.focus();}
function returnToMenu(){if(state&&!state.banked){profile.xp+=state.xpGain||0;profile.coins+=state.coinGain||0;state.banked=true;saveProfile();}cleanupGame();state=null;els.pauseOverlay.classList.add('hidden');showScreen(els.menuScreen);updateMenu();}
function cleanupGame(){cancelAnimationFrame(rafId);rafId=0;roundToken++;}
function endGame(reason='complete'){
  if(!state)return;cancelAnimationFrame(rafId);state.stopped=true;state.paused=false;els.pauseOverlay.classList.add('hidden');
  if(state.cfg.mode==='blitz')profile.bestBlitz=Math.max(profile.bestBlitz,state.blitzCorrect);if(state.cfg.mode==='survival')profile.bestSurvival=Math.max(profile.bestSurvival,state.survivalCorrect);
  let win=state.playerScore>state.botScore; if(!state.cfg.bot&&state.cfg.mode!=='twoPlayer')win=reason!=='survival_fail';
  if(state.cfg.mode==='tournament')win=state.stagePlayer>state.stageBot;
  if(state.cfg.mode==='twoPlayer')win=state.playerScore!==state.botScore;
  if(reason==='complete'&&state.cfg.bot){if(win){profile.wins++;unlockAchievement('first_win')}else profile.losses++;}
  if(state.risk){if(win){state.coinGain+=200;flashToast('🎲 Risk yutildi: +200 tanga');} }
  if(state.cfg.mode==='career'&&win){const idx=state.cfg.careerIndex||0;if(profile.careerCompleted<=idx){profile.careerCompleted=idx+1;state.coinGain+=DATA.careers[idx].reward;flashToast(`🎓 Karyera mukofoti +${DATA.careers[idx].reward}`);}if(profile.careerCompleted>=4)unlockAchievement('career4');}
  if(state.cfg.mode==='mystery'&&win)unlockAchievement('mystery');
  if(state.cfg.mode==='blitz'&&state.blitzCorrect>=20)unlockAchievement('blitz20');if(state.cfg.mode==='survival'&&state.survivalCorrect>=15)unlockAchievement('survival15');
  if(state.playerScore>=10&&state.botScore===0)unlockAchievement('perfect');if(state.cfg.difficulty==='hard'&&win&&state.cfg.bot)unlockAchievement('hard_win');
  profile.xp+=state.xpGain;profile.coins+=state.coinGain;state.banked=true;profile.weekly.best=Math.max(profile.weekly.best,state.playerScore*100+state.xpGain);checkAchievements();checkDailyRewards();saveProfile();showResult(reason,win);
}
function showResult(reason,win){
  if(reason==='stopped'){els.resultEmoji.textContent='⏹️';els.resultTitle.textContent='O‘YIN TO‘XTATILDI';}
  else if(reason==='survival_fail'){els.resultEmoji.textContent='❤️‍🩹';els.resultTitle.textContent='SURVIVAL TUGADI';}
  else if(reason==='tournament_loss'){els.resultEmoji.textContent='🥈';els.resultTitle.textContent='TURNIR TUGADI';}
  else if(state.cfg.mode==='twoPlayer'){els.resultEmoji.textContent='👥';els.resultTitle.textContent=state.playerScore===state.botScore?'DURANG':`${state.playerScore>state.botScore?'1':'2'}-O‘YINCHI G‘OLIB`;}
  else if(win){els.resultEmoji.textContent='🏆';els.resultTitle.textContent='G‘ALABA!';sfx('win');}else{els.resultEmoji.textContent='🤖';els.resultTitle.textContent='BOT YUTDI';}
  els.resultText.textContent=state.cfg.mode==='blitz'?`60 soniyada ${state.blitzCorrect} ta brend topdingiz.`:state.cfg.mode==='survival'?`Xatosiz ${state.survivalCorrect} ta brend topdingiz.`:`Natija: ${state.playerScore} — ${state.botScore}`;
  els.finalPlayerLabel.textContent=state.cfg.mode==='twoPlayer'?'O‘YINCHI 1':'SIZ';els.finalBotLabel.textContent=state.cfg.mode==='twoPlayer'?'O‘YINCHI 2':(state.cfg.bot?'BOT':'REKORD');els.finalPlayer.textContent=state.playerScore;els.finalBot.textContent=state.botScore;
  els.finalXP.textContent=`+${state.xpGain} XP`;els.finalCoins.textContent=`+${state.coinGain}`;els.finalStreak.textContent=`${state.bestStreak} streak`;els.rankText.textContent=rankName();els.factCard.textContent=state.lastFact||'Har bir o‘yin kolleksiya va statistikangizni boyitadi.';showScreen(els.resultScreen);
}

function trackDaily(key,val,maxMode=false){
  ensureDailyNoSave();if(maxMode)profile.daily.progress[key]=Math.max(profile.daily.progress[key]||0,val);else profile.daily.progress[key]=(profile.daily.progress[key]||0)+val;checkDailyRewards();
}
function ensureDailyNoSave(){const d=localDateKey();if(profile.daily.date!==d)profile.daily={date:d,progress:{play:0,correct:0,streak:0},claimed:{}};}
function checkDailyRewards(){
  const rules={play:[3,100],correct:[15,150],streak:[5,200]};let all=true;for(const [k,[target,reward]] of Object.entries(rules)){if((profile.daily.progress[k]||0)>=target&&!profile.daily.claimed[k]){profile.daily.claimed[k]=true;profile.coins+=reward;flashToast(`📅 Kunlik vazifa: +${reward} tanga`);}if(!profile.daily.claimed[k])all=false;}if(all)unlockAchievement('daily3');
}
function checkAchievements(){
  if(profile.bestStreak>=3)unlockAchievement('streak3');if(profile.bestStreak>=10)unlockAchievement('streak10');if(Object.keys(profile.collection).length>=50)unlockAchievement('collector50');if(Object.keys(profile.collection).length>=100)unlockAchievement('collector100');if(profile.xp+state?.xpGain>=5000)unlockAchievement('xp5000');
}
function unlockAchievement(id){if(profile.achievements[id])return;const a=DATA.achievements.find(x=>x.id===id);if(!a)return;profile.achievements[id]=Date.now();profile.coins+=100;flashToast(`${a.icon} Yutuq: ${a.name} • +100 tanga`);}

function renderHistory(winner){
  if(!state)return; if(winner){state.history.push({brand:state.current?.name||'Savol',winner});}
  const max=Math.min(state.cfg.rounds,15);els.historyList.innerHTML='';for(let i=0;i<max;i++){const h=state.history[i];const div=document.createElement('div');div.className='history-item'+(i===state.round&&!state.roundEnded?' current':'');div.innerHTML=`<span class="n">${String(i+1).padStart(2,'0')}</span><span>${h?escapeHtml(h.brand):(i===state.round?'Hozirgi':'—')}</span><span class="w">${h?(h.winner==='player'?'✅':h.winner==='bot'?'🤖':'•'):''}</span>`;els.historyList.appendChild(div);}els.missionProgress.textContent=`Bugun: ${profile.daily.progress.correct}/15 to‘g‘ri • ${profile.daily.progress.streak}/5 streak`;
}
function randomBotLine(){const a=state.bot.lines;return a[Math.floor(Math.random()*a.length)]}

function resetLogoTransform(){
  // UNIVERSAL AUTO-FIT: logo hech qachon karta chegarasidan chiqmaydi.
  els.logoViewport.style.width='94%';els.logoViewport.style.height='88%';
  els.logoViewport.style.padding='24px 34px';
  els.brandLogo.style.filter='none';els.brandLogo.style.transform='none';
  els.brandLogo.style.width='100%';els.brandLogo.style.height='100%';
  els.brandLogo.style.maxWidth='100%';els.brandLogo.style.maxHeight='100%';
  els.brandLogo.style.objectFit='contain';els.brandLogo.style.objectPosition='50% 50%';
  els.brandLogo.style.clipPath='none';
}
function applyDifficultyTransform(){
  resetLogoTransform();
  const mode=state.cfg.mode;let d=state.cfg.difficulty;
  if(mode==='mystery'){const r=Math.random();if(r<.35)d='easy';else if(r<.72)d='medium';else d='hard';}
  // Logo qismlari rejimida ham rasm kattalashtirilmaydi: to‘liq canvas ichida qoladi.
  if(mode==='crop'){
    els.logoViewport.style.width='88%';els.logoViewport.style.height='82%';
    els.logoViewport.style.padding='32px 42px';
    els.brandLogo.style.filter='grayscale(.35) contrast(1.10)';
    return;
  }
  if(d==='easy')return;
  if(d==='medium'){
    els.brandLogo.style.filter=Math.random()<.5?'grayscale(.9) contrast(1.08)':'blur(.65px) saturate(.82) contrast(1.06)';
    return;
  }
  // Qiyin rejim: faqat vizual effekt. Masshtab 1.0 dan oshmaydi.
  els.brandLogo.style.filter=Math.random()<.55?'grayscale(1) contrast(1.14) brightness(.94)':'blur(1.05px) grayscale(.35) contrast(1.12)';
}

function revealLogo(){resetLogoTransform();if(state?.cfg.mode==='color')els.brandLogo.style.filter='none';}
function retryCurrentLogo(){if(!state)return;state.logoFailCount=0;els.retryLogoBtn.classList.add('hidden');const t=++roundToken;if(state.current){loadLogo(state.current,t).then(ok=>{if(!state||t!==roundToken)return;if(ok&&!state.roundEnded){prepareQuestionUI();beginRoundClock();}else nextRound();});}else nextRound();}

function logoCandidates(brand){
  const slug=encodeURIComponent(brand.slug),domain=encodeURIComponent(brand.domain);return [
    {name:'Simple Icons CDN',kind:'svg',url:`https://cdn.simpleicons.org/${slug}`},
    {name:'Iconify HD',kind:'svg',url:`https://api.iconify.design/simple-icons:${slug}.svg?height=384`},
    {name:'Iconify Backup',kind:'svg',url:`https://api.simplesvg.com/simple-icons:${slug}.svg?height=384`},
    {name:'jsDelivr Simple Icons',kind:'svg',url:`https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/${slug}.svg`},
    {name:'Google 512',kind:'bitmap',url:`https://www.google.com/s2/favicons?domain_url=https://${domain}&sz=512`},
    {name:'Icon Horse',kind:'bitmap',url:`https://icon.horse/icon/${domain}`}
  ];
}
async function loadLogo(brand,token){
  els.logoLoading.classList.remove('hidden');els.logoViewport.classList.add('hidden');els.textQuestion.classList.add('hidden');els.fallbackLogo.classList.add('hidden');els.retryLogoBtn.classList.add('hidden');setSource('loading','HD logo qidirilmoqda...');
  const cached=await idbGet('logo:v3:'+brand.name).catch(()=>null);if(cached&&cached.data){const ok=await showImage(cached.data,token,cached.kind||'svg');if(ok){els.qualityBadge.textContent='HD AUTOFIT';setSource('ok','✓ Auto-Fit HD kesh');return true;}}
  for(const c of logoCandidates(brand)){
    if(token!==roundToken)return false;let ok=false;
    if(c.kind==='svg') ok=await showSvgAutoFit(brand,c,token);
    else ok=await showImage(c.url,token,c.kind);
    if(ok){els.qualityBadge.textContent=c.kind==='svg'?'HD AUTOFIT':'HD';setSource('ok',`✓ ${c.name}`);return true;}
  }
  els.logoLoading.classList.add('hidden');els.fallbackLogo.classList.remove('hidden');els.qualityBadge.textContent='XATO';setSource('fail','Logo topilmadi — boshqa brend tanlanadi');return false;
}
function showImage(url,token,kind){return new Promise(resolve=>{const img=new Image();let done=false;const finish=v=>{if(done)return;done=true;clearTimeout(timer);img.onload=null;img.onerror=null;resolve(v)};const timer=setTimeout(()=>finish(false),kind==='svg'?2600:2900);img.onload=()=>{if(token!==roundToken){finish(false);return;}if(kind==='bitmap'&&(img.naturalWidth<64||img.naturalHeight<64)){finish(false);return;}resetLogoTransform();els.brandLogo.src=url;els.logoLoading.classList.add('hidden');els.logoViewport.classList.remove('hidden');els.fallbackLogo.classList.add('hidden');finish(true)};img.onerror=()=>finish(false);img.referrerPolicy='no-referrer';img.decoding='async';img.src=url;});}

async function showSvgAutoFit(brand,c,token){
  try{
    const text=await fetchText(c.url,2200);
    if(text&&text.includes('<svg')&&text.length<350000){
      const fixed=await normalizeSvgVisualBounds(text);
      const data='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(fixed||text);
      const ok=await showImage(data,token,'svg');
      if(ok){idbPut('logo:v3:'+brand.name,{data,kind:'svg',at:Date.now()}).catch(()=>{});return true;}
    }
  }catch(_){}
  // CORS bloklasa ham to‘g‘ridan-to‘g‘ri URL contain rejimida sinab ko‘riladi.
  return await showImage(c.url,token,'svg');
}

async function normalizeSvgVisualBounds(svgText){
  try{
    const doc=new DOMParser().parseFromString(svgText,'image/svg+xml');
    const svg=doc.documentElement;
    if(!svg||String(svg.nodeName).toLowerCase()!=='svg')return svgText;
    // Masofadagi SVG ichidagi bajariladigan kontentni olib tashlaymiz.
    svg.querySelectorAll('script,foreignObject').forEach(n=>n.remove());
    svg.querySelectorAll('*').forEach(el=>{for(const a of [...el.attributes])if(/^on/i.test(a.name))el.removeAttribute(a.name)});
    svg.setAttribute('xmlns','http://www.w3.org/2000/svg');
    svg.setAttribute('preserveAspectRatio','xMidYMid meet');
    svg.removeAttribute('width');svg.removeAttribute('height');

    // Haqiqiy chizilgan shakl chegarasini o‘lchash uchun vaqtincha ekranga joylaymiz.
    const host=document.createElement('div');
    host.style.cssText='position:fixed;left:-10000px;top:-10000px;width:1000px;height:1000px;opacity:0;pointer-events:none;overflow:visible;z-index:-9999';
    const live=document.importNode(svg,true);
    live.setAttribute('width','1000');live.setAttribute('height','1000');
    live.style.overflow='visible';host.appendChild(live);document.body.appendChild(host);
    await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
    let box=null;
    try{box=live.getBBox({fill:true,stroke:true,markers:true});}catch(_){try{box=live.getBBox();}catch(__){box=null;}}
    host.remove();
    if(box&&isFinite(box.x)&&isFinite(box.y)&&box.width>0&&box.height>0){
      const pad=Math.max(box.width,box.height)*0.10;
      svg.setAttribute('viewBox',`${box.x-pad} ${box.y-pad} ${box.width+pad*2} ${box.height+pad*2}`);
    }
    svg.setAttribute('preserveAspectRatio','xMidYMid meet');
    return new XMLSerializer().serializeToString(svg);
  }catch(_){return svgText;}
}

async function cacheSvgLater(brand,c){try{const text=await fetchText(c.url,1800);if(text&&text.includes('<svg')&&text.length<350000){const fixed=await normalizeSvgVisualBounds(text);const data='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(fixed||text);await idbPut('logo:v3:'+brand.name,{data,kind:'svg',at:Date.now()});}}catch(_){}}
async function fetchText(url,timeout){const ctrl=new AbortController();const t=setTimeout(()=>ctrl.abort(),timeout);try{const r=await fetch(url,{signal:ctrl.signal,cache:'force-cache'});if(!r.ok)return null;return await r.text();}finally{clearTimeout(t)}}
function prefetchNext(){if(!state||state.cfg.mode==='history'||state.cfg.mode==='description')return;const b=state.queue.find(x=>!state.used.has(x.name));if(!b)return;idbGet('logo:v3:'+b.name).then(v=>{if(v)return;const c=logoCandidates(b)[0];cacheSvgLater(b,c);}).catch(()=>{});}
function setSource(mode,text){const row=els.sourceText.parentElement;row.classList.remove('ok','fail');if(mode==='ok')row.classList.add('ok');if(mode==='fail')row.classList.add('fail');els.sourceText.textContent=text;els.retryLogoBtn.classList.toggle('hidden',mode!=='fail');}

function getLogoDB(){
  if(logoDBPromise)return logoDBPromise;logoDBPromise=new Promise((resolve,reject)=>{if(!window.indexedDB){reject(new Error('no idb'));return;}const req=indexedDB.open('GMB_ULTRA_CACHE_V3_AUTOFIT',1);req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains('kv'))db.createObjectStore('kv')};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});return logoDBPromise;
}
async function idbGet(key){const db=await getLogoDB();return new Promise((res,rej)=>{const tx=db.transaction('kv','readonly'),r=tx.objectStore('kv').get(key);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});}
async function idbPut(key,val){const db=await getLogoDB();return new Promise((res,rej)=>{const tx=db.transaction('kv','readwrite');tx.objectStore('kv').put(val,key);tx.oncomplete=()=>res();tx.onerror=()=>rej(tx.error);});}
async function clearLogoDB(){try{const db=await getLogoDB();await new Promise((res,rej)=>{const tx=db.transaction('kv','readwrite');tx.objectStore('kv').clear();tx.oncomplete=res;tx.onerror=()=>rej(tx.error);});}catch(_){}}

function flashToast(text){clearTimeout(toastTimer);els.toast.textContent=text;els.toast.classList.add('show');toastTimer=setTimeout(()=>els.toast.classList.remove('show'),1800);}
function sfx(type){if(!profile.settings.sfx)return;try{const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;if(!window.__gmbac)window.__gmbac=new AC();const ac=window.__gmbac,o=ac.createOscillator(),g=ac.createGain(),now=ac.currentTime;const f={good:720,bad:170,bot:300,win:520,buy:640,power:880,tick:450}[type]||440;o.type=type==='bad'?'sawtooth':'sine';o.frequency.setValueAtTime(f,now);if(type==='win')o.frequency.exponentialRampToValueAtTime(980,now+.28);g.gain.setValueAtTime(.0001,now);g.gain.exponentialRampToValueAtTime(.045,now+.01);g.gain.exponentialRampToValueAtTime(.0001,now+.18);o.connect(g);g.connect(ac.destination);o.start();o.stop(now+.24);}catch(_){}}
function startMusic(){stopMusic();try{const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;if(!window.__gmbac)window.__gmbac=new AC();const ac=window.__gmbac;[110,164.81,220].forEach((f,i)=>{const o=ac.createOscillator(),g=ac.createGain();o.type=i===1?'triangle':'sine';o.frequency.value=f;g.gain.value=.0035;o.connect(g);g.connect(ac.destination);o.start();musicNodes.push(o,g);});}catch(_){}}
function stopMusic(){musicNodes.forEach(n=>{try{n.stop?.();n.disconnect?.()}catch(_){}});musicNodes=[];}

init();
})();
