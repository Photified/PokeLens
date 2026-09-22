import {prepare,identify,summarizePrices,nameCandidates,rankCandidates,mergeEvidence} from './matcher.js';
import {visualRank,sameFrame} from './visual.js';
import {cardViews,textRegion} from './imaging.js';
const $=id=>document.getElementById(id);
let catalog, cards=[], workerPromise, stream, timer, busy=false, deferredInstall=null, photoURL=null;
let selectedDuringScan=false;
let resultCandidates=[], candidateCount=0, scanGeneration=0;
let pref={auto:true,speak:false}, recent=[];
try { pref={...pref,...JSON.parse(localStorage.getItem('pokelens-prefs')||'{}')}; recent=JSON.parse(localStorage.getItem('pokelens-recent')||'[]'); if(!Array.isArray(recent))recent=[]; } catch {}
const money=x=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(x);
const priceText=p=>!p?'No price available':p.low===p.high?money(p.low):`${money(p.low)} – ${money(p.high)}`;
function savePrefs(){try{localStorage.setItem('pokelens-prefs',JSON.stringify(pref));}catch{}}
function status(text,error=false){$('status').textContent=text;$('statusDot').style.background=error?'#ffc490':'var(--mint)';}
function message(title,text){$('messageTitle').textContent=title;$('messageText').textContent=text;if(!$('message').open)$('message').showModal();}
function safeURL(url){try{const u=new URL(url);return u.protocol==='https:'?u.href:'';}catch{return '';}}
async function loadCatalog(){
  try {
    const response=await fetch('./data/catalog.json',{cache:'no-cache'});
    if(!response.ok)throw new Error('catalog');
    const data=await response.json();
    if(!Array.isArray(data.cards)||!data.cards.length)throw new Error('empty');
    catalog=data;cards=prepare(data.cards);
    $('catalogInfo').textContent=`${data.cardCount.toLocaleString()} listings · ${data.setCount} sets · TCGplayer via TCGCSV`;
    $('scanButton').disabled=false;$('uploadButton').disabled=false;$('scanLabel').textContent='Scan a card';
    status('Ready to scan. No typing needed.');
  } catch {status('Catalog unavailable. Reconnect and tap to retry.',true);$('scanButton').disabled=false;$('scanLabel').textContent='Retry loading catalog';}
}
function getWorker(){
  if(!workerPromise){
    workerPromise=(async()=>{
      if(!window.Tesseract)throw new Error('Scanner files did not load. Reload the app.');
      status('Preparing scanner on this device…');
      const w=await Tesseract.createWorker('eng',1,{
        workerPath:new URL('./vendor/worker.min.js',location.href).href,
        corePath:new URL('./vendor/',location.href).href,
        langPath:new URL('./vendor/best/',location.href).href,
        cachePath:'pokelens-ocr-v11',
        logger:m=>{if(busy&&m.status==='recognizing text')status('Reading card… '+Math.round(m.progress*100)+'%');}
      });
      await w.setParameters({tessedit_pageseg_mode:'11',preserve_interword_spaces:'1'});
      return w;
    })().catch(e=>{workerPromise=null;throw e;});
  }
  return workerPromise;
}
function stopCamera(){scanGeneration++;clearTimeout(timer);if(stream){stream.getTracks().forEach(t=>t.stop());stream=null;}$('camera').srcObject=null;$('camera').hidden=true;$('stopCamera').hidden=true;$('cameraLabel').textContent='READY WHEN YOU ARE';if(!$('captured').src)$('idleArt').hidden=false;$('scanLabel').textContent='Scan a card';}
function schedule(){clearTimeout(timer);if(stream&&pref.auto&&!busy&&!$('settings').open&&!$('message').open&&$('result').hidden)timer=setTimeout(()=>scanCamera(),1800);}
async function startCamera(){
  if(busy)return;
  if(!cards.length)return loadCatalog();
  try {
    if(!navigator.mediaDevices?.getUserMedia)throw new Error('Camera access requires HTTPS. Open your GitHub Pages URL in Chrome or Safari.');
    stopCamera();clearPhoto();$('result').hidden=true;
    stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:'environment'},width:{ideal:3840},height:{ideal:2160}}});
    const track=stream.getVideoTracks()[0];
    try{if(track.getCapabilities?.().focusMode?.includes('continuous'))await track.applyConstraints({advanced:[{focusMode:'continuous'}]});}catch{}
    $('camera').srcObject=stream;$('camera').hidden=false;await $('camera').play();
    $('idleArt').hidden=true;$('stopCamera').hidden=false;$('viewfinder').hidden=false;
    $('cameraLabel').textContent='CAMERA ON';$('scanLabel').textContent='Scan now';$('frameHint').textContent='Fill the frame. Hold steady.';
    status(pref.auto?'Hold your card in the frame. Scanning automatically.':'Line up your card and tap Scan now.');
    getWorker().catch(()=>{});schedule();
  } catch(e){stopCamera();status('Camera unavailable. You can scan a photo instead.',true);message('Camera access',e.name==='NotAllowedError'?'Allow camera access in your browser settings, then try again. You can also use Scan a photo.':e.message||'Could not open the camera. Try Scan a photo.');}
}
function clearPhoto(){if(photoURL){URL.revokeObjectURL(photoURL);photoURL=null;}$('captured').removeAttribute('src');$('captured').hidden=true;}
function cameraFrame(){
  const video=$('camera'),box=video.getBoundingClientRect(),frame=$('viewfinder').getBoundingClientRect();
  const scale=Math.max(box.width/video.videoWidth,box.height/video.videoHeight);
  const ox=(video.videoWidth*scale-box.width)/2,oy=(video.videoHeight*scale-box.height)/2;
  const sx=(frame.left-box.left+ox)/scale,sy=(frame.top-box.top+oy)/scale;
  const sw=frame.width/scale,sh=frame.height/scale;
  const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(sw));canvas.height=Math.max(1,Math.round(sh));
  canvas.getContext('2d').drawImage(video,sx,sy,sw,sh,0,0,canvas.width,canvas.height);return canvas;
}
async function scanCamera(){if(busy||!stream||!$('camera').videoWidth)return;scheduleStop();await runScan(cameraFrame(),true);}
function scheduleStop(){clearTimeout(timer);}
async function runScan(canvas,fromCamera=false){
  if(busy)return;
  const generation=scanGeneration;
  busy=true;selectedDuringScan=false;resultCandidates=[];$('result').hidden=true;$('nextScan').disabled=true;$('scanButton').disabled=true;$('uploadButton').disabled=true;
  document.querySelector('.scanner').classList.add('busy');$('scanLabel').textContent='Scanning…';
  try {
    const w=await getWorker(),views=cardViews(canvas),aligned=views[0];
    await w.setParameters({tessedit_pageseg_mode:'7'});
    status('Reading card details…');
    let title=(await w.recognize(textRegion(aligned,'title','color'))).data.text;
    if(!nameCandidates(title,cards).length){for(const view of views.slice(1,3)){title+='\n'+(await w.recognize(textRegion(view,'title','color'))).data.text;if(nameCandidates(title,cards).length)break;}}
    await w.setParameters({tessedit_pageseg_mode:'11'});
    let combinedText=title+'\n'+(await w.recognize(textRegion(canvas,'full','legacy'))).data.text;
    // The original image is read too: holders can confuse the edge-based crop.
    combinedText+='\n'+(await w.recognize(textRegion(aligned,'bottom','gray'))).data.text;
    let ranked=rankCandidates(combinedText,cards,combinedText);
    if(!ranked.length){
      combinedText+='\n'+(await w.recognize(textRegion(aligned,'full','gray'))).data.text;
      ranked=rankCandidates(combinedText,cards,combinedText);
    }
    if(fromCamera&&stream&&generation===scanGeneration){
      const next=cameraFrame();
      // Fuse text only while the same card is still present, never across unrelated pulls.
      if(sameFrame(canvas,next)){
        combinedText+='\n'+(await w.recognize(textRegion(next,'full','gray'))).data.text;
        views.push(...cardViews(next).slice(0,3));
        ranked=rankCandidates(combinedText,cards,combinedText);
      }
    }
    if(fromCamera&&(!stream||generation!==scanGeneration))return;
    if(ranked.length){
      // Render useful suggestions before downloading any reference images.
      showCandidates(ranked,fromCamera,false);
      status('Possible matches found. Comparing artwork…');
      const visual=await visualRank(views,ranked.slice(0,120).map(r=>r.card));
      if(fromCamera&&(!stream||generation!==scanGeneration))return;
      ranked=mergeEvidence(ranked,visual);
      if(!selectedDuringScan)showCandidates(ranked,fromCamera,true);else resultCandidates=ranked;
      if(!fromCamera){clearPhoto();$('captured').src=canvas.toDataURL('image/jpeg',.8);$('captured').hidden=false;$('idleArt').hidden=true;$('viewfinder').hidden=true;}
      status(selectedDuringScan?'Selected card. Tap Scan next card to continue.':'Possible matches ready. Scroll to compare printings.');
      $('frameHint').textContent='Matches below. Tap Scan next card to continue.';
    }else{
      status('No useful match yet. '+(fromCamera?'Checking again automatically.':'Try a closer photo.'),true);
      $('frameHint').textContent='Keep the card in view.';
    }
  }catch(e){status('Scan interrupted. Tap Scan now to retry.',true);message('Scanner unavailable',e.message||'Reload the app and try again.');}
  finally{busy=false;$('nextScan').disabled=false;document.querySelector('.scanner').classList.remove('busy');$('scanButton').disabled=false;$('uploadButton').disabled=false;$('scanLabel').textContent=stream?'Scan now':'Scan a card';schedule();}
}
function showCandidates(ranked,fromCamera=false,settled=true){
 const previousTop=resultCandidates[0]?.card.id;const scrollTop=$('candidateList').scrollTop;
 resultCandidates=ranked;candidateCount=0;
 $('result').hidden=false;$('resultLabel').textContent='POSSIBLE MATCHES';
 $('price').hidden=true;$('priceNote').textContent='Compare the image and printing. Tap your card.';
 document.querySelector('.matched-card').hidden=true;$('variantPrices').hidden=true;
 $('listing').hidden=true;const date=new Date(catalog.sourceUpdated);const stale=Number.isFinite(+date)&&Date.now()-date.getTime()>3*86400000;
 $('priceDate').textContent=(stale?'Older prices · ':'Updated ')+(Number.isFinite(+date)?date.toLocaleDateString():'date unavailable');
 $('candidateList').hidden=false;$('candidateList').replaceChildren();appendCandidates();$('candidateList').scrollTop=scrollTop;
 // Avoid jumping the page while the user compares options or the ranking updates.
 if(!fromCamera&&previousTop==null)$('result').scrollIntoView({behavior:'smooth',block:'nearest'});
 if(settled)navigator.vibrate?.(40);
}
function appendCandidates(){
 const end=Math.min(candidateCount+12,resultCandidates.length);
 for(;candidateCount<end;candidateCount++){
  const {card,evidence}=resultCandidates[candidateCount];
  const button=document.createElement('article');button.className='candidate';button.setAttribute('role','listitem');
  const choose=selection=>{selectedDuringScan=busy;showResult(selection);$('resultLabel').textContent='SELECTED CARD';};
  const image=document.createElement('img');image.loading='lazy';image.alt=card.name;image.src=safeURL(card.image);image.onerror=()=>image.hidden=true;
  const info=document.createElement('span');info.className='candidate-info';
  const title=document.createElement('button');title.type='button';title.className='candidate-select';title.textContent=card.name;title.onclick=()=>choose([card]);
  const detail=document.createElement('span');detail.textContent=card.set+(card.number?' · #'+card.number:'');
  const clues=document.createElement('small');clues.textContent=evidence.length?evidence.join(' · '):'Possible printing';
  info.append(title,detail,clues);
  const prices=(card.prices||[]).filter(p=>typeof p.market==='number'&&Number.isFinite(p.market)&&p.market>=0);
  for(const p of prices){const row=document.createElement('button');row.type='button';row.className='candidate-price';row.textContent=p.type+' · '+money(p.market);row.setAttribute('aria-label',card.name+', '+p.type+', '+money(p.market));row.onclick=()=>choose([{...card,prices:[p]}]);info.append(row);}
  if(!prices.length){const row=document.createElement('span');row.textContent='No market price available';info.append(row);}
  button.append(image,info);
  $('candidateList').append(button);
 }
 $('moreMatches').hidden=candidateCount>=resultCandidates.length;
 $('moreMatches').textContent=`Show more matches (${resultCandidates.length-candidateCount})`;
 $('backMatches').hidden=true;
}
$('moreMatches').onclick=appendCandidates;
$('backMatches').onclick=()=>{selectedDuringScan=false;return showCandidates(resultCandidates,!!stream,false);};
function showResult(matches,record=true){
  const card=matches[0],p=summarizePrices(matches);$('result').hidden=false;
  $('resultLabel').textContent='SELECTED CARD';$('price').hidden=false;document.querySelector('.matched-card').hidden=false;$('variantPrices').hidden=false;
  $('candidateList').hidden=true;$('moreMatches').hidden=true;$('backMatches').hidden=!resultCandidates.length;
  $('price').textContent=priceText(p);
  $('priceNote').textContent=!p?'This listing has no market price yet.':p.rows.length>1?'Available printing prices. Foil and edition may vary.':(p.rows[0].type+' · market reference');
  $('cardName').textContent=card._name?card.name:card.name;$('cardSet').textContent=new Set(matches.map(c=>c.group)).size>1?'Multiple matching printings':card.set;$('cardNumber').textContent=card.number?'#'+card.number:'';
  $('cardImage').hidden=!safeURL(card.image);if(safeURL(card.image))$('cardImage').src=safeURL(card.image);
  $('cardImage').alt=card.name;$('cardImage').onerror=()=>$('cardImage').hidden=true;
  $('listing').href=safeURL(card.url);$('listing').hidden=!safeURL(card.url);
  const date=new Date(catalog.sourceUpdated);const valid=!Number.isNaN(+date);
  const stale=valid && Date.now()-date.getTime()>3*86400000;
  $('priceDate').textContent=(stale?'Older prices · ':'Updated ')+(valid?date.toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}):'date unavailable');
  $('variantPrices').replaceChildren();
  if(p&&p.rows.length>1){
    const seen=new Set();for(const row of p.rows){const key=row.card+row.type+row.market;if(seen.has(key))continue;seen.add(key);const el=document.createElement('span');el.className='variant';el.textContent=`${matches.length>1?row.card+' · ':''}${row.type} ${money(row.market)}`;$('variantPrices').append(el);}
  }
  $('result').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'nearest'});
  if(record){
    recent=[{ids:matches.map(c=>c.id),types:matches.length===1?matches[0].prices.map(p=>p.type):null,name:card.name,image:card.image,display:priceText(p)},...recent.filter(r=>r.ids?.[0]!==card.id)].slice(0,5);
    try{localStorage.setItem('pokelens-recent',JSON.stringify(recent));}catch{}renderRecent();
    if(pref.speak&&'speechSynthesis'in window){const spoken=!p?'No price available':p.low===p.high?`${p.low} US dollars`:`${p.low} to ${p.high} US dollars, depending on printing`;speechSynthesis.cancel();speechSynthesis.speak(new SpeechSynthesisUtterance(`${card.name}. ${spoken}.`));}
    navigator.vibrate?.(60);
  }
}
function renderRecent(){
  $('recentSection').hidden=!recent.length;$('recentList').replaceChildren();
  for(const r of recent){const b=document.createElement('button');b.className='recent-item';const im=document.createElement('img');im.alt='';im.src=safeURL(r.image);im.onerror=()=>im.hidden=true;const name=document.createElement('strong');name.textContent=r.name;const p=document.createElement('span');p.textContent=r.display;b.append(im,name,p);b.onclick=()=>{if(busy)return;resultCandidates=[];const matches=cards.filter(c=>r.ids.includes(c.id));if(matches.length){stopCamera();showResult(r.types?matches.map(c=>({...c,prices:c.prices.filter(p=>r.types.includes(p.type))})):matches,false);}else message('Card unavailable','Refresh the catalog and try scanning this card again.');};$('recentList').append(b);}
}
$('scanButton').onclick=()=>{resultCandidates=[];$('result').hidden=true;return stream?scanCamera():startCamera();};
$('stopCamera').onclick=()=>{stopCamera();status('Camera stopped.');};
$('nextScan').onclick=()=>{if(busy)return;resultCandidates=[];$('result').hidden=true;window.scrollTo({top:0,behavior:'smooth'});if(stream){status('Scanning automatically.');scanCamera();}else startCamera();};
$('uploadButton').onclick=()=>{if(!busy)$('photoInput').click();};
$('photoInput').onchange=async e=>{
  const file=e.target.files?.[0];if(!file||busy)return;stopCamera();clearPhoto();
  try{
    photoURL=URL.createObjectURL(file);const im=new Image();im.src=photoURL;await im.decode();
    const c=document.createElement('canvas'),scale=Math.min(1,3200/Math.max(im.width,im.height));c.width=Math.round(im.width*scale);c.height=Math.round(im.height*scale);c.getContext('2d').drawImage(im,0,0,c.width,c.height);
    $('captured').src=photoURL;$('captured').hidden=false;$('idleArt').hidden=true;$('viewfinder').hidden=true;
    await runScan(c);
  }catch{message('Photo unavailable','Choose a JPG, PNG or WebP photo and try again.');}
  e.target.value='';
};
$('settingsOpen').onclick=()=>{scheduleStop();$('settings').showModal();updateInstallHelp();};
$('settingsClose').onclick=()=>$('settings').close();$('settings').addEventListener('close',schedule);
for(const dialog of [$('settings'),$('message')])dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
$('messageClose').onclick=$('messageOkay').onclick=()=>$('message').close();$('message').addEventListener('close',schedule);
$('autoScan').checked=pref.auto;$('speak').checked=pref.speak;
$('autoScan').onchange=e=>{pref.auto=e.target.checked;savePrefs();schedule();};$('speak').onchange=e=>{pref.speak=e.target.checked;savePrefs();};
$('clearRecent').onclick=()=>{recent=[];try{localStorage.removeItem('pokelens-recent');}catch{}renderRecent();};
$('refreshData').onclick=async()=>{if(busy){message('Scan in progress','Let this scan finish, then refresh the catalog.');return;}$('refreshData').disabled=true;await loadCatalog();$('refreshData').disabled=false;message('Catalog checked',catalog?`${catalog.cardCount.toLocaleString()} listings loaded. Prices update after your daily GitHub workflow finishes.`:'Could not load the catalog. Check your connection.');};
function installed(){return matchMedia('(display-mode: standalone)').matches||navigator.standalone;}
function updateInstallHelp(){
  $('install').textContent=installed()?'App installed':'Install App';$('install').disabled=!!installed();
  $('installHelp').textContent=installed()?'You’re using the installed app.':deferredInstall?'Add PokéLens to your home screen.':/iPad|iPhone|iPod/.test(navigator.userAgent)?'In Safari: Share → Add to Home Screen → Add.':'Open your browser menu and choose Install app or Add to Home screen.';
}
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstall=e;updateInstallHelp();});
window.addEventListener('appinstalled',()=>{deferredInstall=null;updateInstallHelp();});
$('install').onclick=async()=>{if(deferredInstall){await deferredInstall.prompt();await deferredInstall.userChoice;deferredInstall=null;updateInstallHelp();}else{updateInstallHelp();message('Install PokéLens',$('installHelp').textContent);}};
document.addEventListener('visibilitychange',()=>{if(document.hidden)stopCamera();});
window.addEventListener('pagehide',stopCamera);
if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});
renderRecent();loadCatalog();
