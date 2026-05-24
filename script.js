
const aud = document.getElementById('aud');
let tracks = [];
let filteredTracks = [];
let queue = [];
let qIdx = -1;
let nowId = null;
let shuffle = false;
let repeat = 0;
let playlists = JSON.parse(localStorage.getItem('muse_pl') || '[]');
let favorites = new Set(JSON.parse(localStorage.getItem('muse_fav') || '[]'));
let playCounts = JSON.parse(localStorage.getItem('muse_pc') || '{}');
let currentTab = 'library';
let activePlId = null;

/* =================== FILE LOADING =================== */
function handleFiles(fileList) {
  const files = Array.from(fileList).filter(f => f.type.startsWith('audio/') || /\.(mp3|m4a|aac|flac|ogg|wav|opus)$/i.test(f.name));
  if (!files.length) { toast('Aucun fichier audio trouvé'); return; }
  const existing = new Set(tracks.map(t => t.file.name + t.file.size));
  const newFiles = files.filter(f => !existing.has(f.name + f.size));
  if (!newFiles.length) { toast('Ces fichiers sont déjà importés'); return; }

  let loaded = 0;
  const newTracks = [];
  newFiles.forEach(file => {
    const id = 'T' + Date.now() + Math.random().toString(36).slice(2);
    const url = URL.createObjectURL(file);
    let raw = file.name.replace(/\.[^.]+$/, '');
    let title = raw, artist = 'Artiste inconnu';
    const sep = raw.match(/\s[-–—]\s/);
    if (sep) {
      const idx = raw.indexOf(sep[0]);
      artist = raw.slice(0, idx).trim();
      title = raw.slice(idx + sep[0].length).trim();
    }
    const t = { id, url, file, title, artist, duration: 0, durStr: '—' };
    const tmp = new Audio(url);
    const finish = () => { newTracks.push(t); loaded++; if (loaded === newFiles.length) finalize(newTracks); };
    tmp.addEventListener('loadedmetadata', () => { t.duration = tmp.duration; t.durStr = fmt(tmp.duration); finish(); });
    tmp.addEventListener('error', finish);
    setTimeout(finish, 4000);
  });
}

function finalize(newTracks) {
  tracks = [...tracks, ...newTracks];
  filteredTracks = [...tracks];
  saveLib();
  const zone = document.getElementById('import-zone');
  zone.classList.add('has-tracks');
  zone.querySelector('.import-icon').textContent = '＋';
  zone.querySelector('.import-title').textContent = `Ajouter d'autres fichiers`;
  zone.querySelector('.import-sub').textContent = `${tracks.length} morceau${tracks.length>1?'x':''} dans la bibliothèque`;
  document.getElementById('search-wrap').style.display = tracks.length > 3 ? 'block' : 'none';
  renderLib();
  renderFavs();
  toast(`<b>${newTracks.length}</b> morceau${newTracks.length>1?'x':''} importé${newTracks.length>1?'s':''}`);
}

function saveLib() { /* URLs are blob, can't serialize — just counts */ }
function saveFavs() { localStorage.setItem('muse_fav', JSON.stringify([...favorites])); }
function savePl() { localStorage.setItem('muse_pl', JSON.stringify(playlists)); }
function savePC() { localStorage.setItem('muse_pc', JSON.stringify(playCounts)); }

/* =================== RENDER =================== */
function fmt(s) {
  if (!s || isNaN(s)) return '—';
  return Math.floor(s/60)+':'+(Math.floor(s%60)+'').padStart(2,'0');
}

function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function heartHTML(id) {
  const loved = favorites.has(id);
  return `<button class="btn-heart${loved?' loved':''}" data-hid="${id}" onclick="tapHeart(event,'${id}')" aria-label="Favori">
    <svg class="heart-svg" viewBox="0 0 24 24"><path class="heart-path" d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
    <div class="heart-burst">${Array.from({length:6},(_,i)=>`<span data-i="${i}"></span>`).join('')}</div>
  </button>`;
}

function trackRowHTML(t, num, context) {
  const playing = t.id === nowId;
  return `<div class="track-row${playing?' is-playing':''}" data-id="${t.id}" onclick="playTrack('${t.id}','${context||'lib'}')">
    <div class="track-num" style="${playing?'display:none':''}">${num}</div>
    <div class="eq-anim${aud.paused?' paused':''}">
      <div class="eq-bar" style="height:5px"></div>
      <div class="eq-bar" style="height:10px"></div>
      <div class="eq-bar" style="height:7px"></div>
    </div>
    <div class="track-meta">
      <div class="track-name">${esc(t.title)}</div>
      <div class="track-artist">${esc(t.artist)}</div>
    </div>
    <div class="track-right">
      ${heartHTML(t.id)}
      <button class="btn-more" onclick="event.stopPropagation();openTrackSheet('${t.id}','${context||'lib'}')">···</button>
      <div class="track-dur">${t.durStr}</div>
    </div>
  </div>`;
}

function renderLib() {
  const list = document.getElementById('lib-list');
  if (!filteredTracks.length) {
    if (!tracks.length) { list.innerHTML = ''; return; }
    list.innerHTML = `<div class="empty"><span class="empty-ico">🔍</span><div class="empty-t">Aucun résultat</div></div>`;
    return;
  }
  list.innerHTML = filteredTracks.map((t,i) => trackRowHTML(t, i+1, 'lib')).join('');
}

function renderFavs() {
  const favs = tracks.filter(t => favorites.has(t.id));
  document.getElementById('fav-sub').textContent = `${favs.length} morceau${favs.length!==1?'x':''}`;
  const list = document.getElementById('fav-list');
  if (!favs.length) {
    list.innerHTML = `<div class="empty"><span class="empty-ico">♡</span><div class="empty-t">Pas encore de favori</div><div class="empty-s">Appuie sur le ♡ d'un morceau pour l'ajouter.</div></div>`;
    return;
  }
  list.innerHTML = favs.map((t,i) => trackRowHTML(t, i+1, 'fav')).join('');
}

function renderPl() {
  const grid = document.getElementById('pl-grid');
  if (!playlists.length) {
    grid.innerHTML = `<div class="empty"><span class="empty-ico">📋</span><div class="empty-t">Aucune playlist</div><div class="empty-s">Crée ta première playlist.</div></div>`;
    return;
  }
  grid.innerHTML = playlists.map(p => {
    const count = p.trackIds.length;
    return `<div class="pl-card" onclick="openPlDetail('${p.id}')">
      <div class="pl-thumb">🎵</div>
      <div class="pl-info">
        <div class="pl-name">${esc(p.name)}</div>
        <div class="pl-meta">${count} morceau${count!==1?'x':''}</div>
      </div>
      <div class="pl-actions">
        <button class="pl-del" onclick="event.stopPropagation();deletePl('${p.id}')">Supp.</button>
      </div>
    </div>`;
  }).join('');
}

function renderPlDetail(id) {
  const pl = playlists.find(p=>p.id==id);
  if (!pl) return;
  document.getElementById('pldet-name').textContent = pl.name;
  const plTracks = pl.trackIds.map(tid => tracks.find(t=>t.id==tid)).filter(Boolean);
  const dur = plTracks.reduce((a,t)=>a+t.duration,0);
  document.getElementById('pldet-meta').textContent = `${plTracks.length} morceaux · ${Math.floor(dur/60)} min`;
  const list = document.getElementById('pldet-list');
  if (!plTracks.length) {
    list.innerHTML = `<div class="empty"><span class="empty-ico">📭</span><div class="empty-t">Playlist vide</div><div class="empty-s">Ajoute des morceaux via le menu ···</div></div>`;
    return;
  }
  list.innerHTML = plTracks.map((t,i) => trackRowHTML(t, i+1, 'pl:'+id)).join('');
}

/* =================== NAVIGATION =================== */
function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.nav-tab').forEach((el,i) => el.classList.toggle('active', ['library','playlists','favorites'][i]===tab));
  document.querySelectorAll('.bnav-btn').forEach(el => el.classList.toggle('active', el.id==='bnav-'+tab));
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById('view-'+tab).classList.add('active');
  if (tab==='playlists') renderPl();
  if (tab==='favorites') renderFavs();
}

function openPlDetail(id) {
  activePlId = id;
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById('view-pldetail').classList.add('active');
  renderPlDetail(id);
}

function backToPlaylists() {
  activePlId = null;
  switchTab('playlists');
}

function filterLib(q) {
  const v = q.trim().toLowerCase();
  filteredTracks = v ? tracks.filter(t => t.title.toLowerCase().includes(v) || t.artist.toLowerCase().includes(v)) : [...tracks];
  renderLib();
}

/* =================== HEART =================== */
function tapHeart(e, id) {
  e.stopPropagation();
  const btn = e.currentTarget;
  const wasLoved = favorites.has(id);
  if (wasLoved) { favorites.delete(id); } else { favorites.add(id); }
  saveFavs();

  // Animate
  btn.classList.toggle('loved', !wasLoved);
  btn.querySelector('.heart-svg').style.transform = 'scale(1.5)';
  setTimeout(() => btn.querySelector('.heart-svg').style.transform = '', 200);

  if (!wasLoved) {
    // Burst particles
    const burst = btn.querySelector('.heart-burst');
    const particles = burst.querySelectorAll('span');
    particles.forEach((p, i) => {
      const angle = (i / particles.length) * 360;
      const rad = (angle * Math.PI) / 180;
      const dist = 18 + Math.random() * 8;
      p.style.cssText = `
        position:absolute;width:5px;height:5px;border-radius:50%;background:var(--red);
        opacity:1;transform:scale(1) translate(${Math.cos(rad)*dist}px,${Math.sin(rad)*dist}px);
        transition:all .4s cubic-bezier(.17,.89,.32,1.27);
      `;
      setTimeout(() => { p.style.opacity='0'; p.style.transform=`scale(0) translate(${Math.cos(rad)*dist*1.5}px,${Math.sin(rad)*dist*1.5}px)`; }, 50);
      setTimeout(() => { p.style.cssText='position:absolute;opacity:0;transform:scale(0);'; }, 500);
    });
  }

  // Update player heart
  if (id === nowId) updatePlayerHeart();
  renderFavs();

  // Re-render hearts in all visible lists without full re-render
  document.querySelectorAll(`.btn-heart[data-hid="${id}"]`).forEach(b => {
    if (b === btn) return;
    b.classList.toggle('loved', favorites.has(id));
    const path = b.querySelector('.heart-path');
    path.style.fill = favorites.has(id) ? 'var(--red)' : 'none';
    path.style.stroke = favorites.has(id) ? 'var(--red)' : 'var(--text3)';
  });
}

function updatePlayerHeart() {
  // handled inline
}

/* =================== PLAYBACK =================== */
function playTrack(id, context) {
  const track = tracks.find(t=>t.id==id);
  if (!track) return;

  // Build queue from context
  if (context === 'fav') queue = tracks.filter(t => favorites.has(t.id));
  else if (context && context.startsWith('pl:')) {
    const plId = context.split(':')[1];
    const pl = playlists.find(p=>p.id==plId);
    queue = pl ? pl.trackIds.map(tid=>tracks.find(t=>t.id==tid)).filter(Boolean) : [...tracks];
  } else queue = [...filteredTracks];

  qIdx = queue.findIndex(t=>t.id==id);
  if (qIdx<0) { queue.push(track); qIdx=queue.length-1; }

  nowId = id;
  aud.src = track.url;
  aud.play().catch(()=>{});
  playCounts[id] = (playCounts[id]||0)+1;
  savePC();
  updateNowPlaying(track);
  highlightPlaying(id);
}

function updateNowPlaying(t) {
  document.getElementById('mini-title').textContent = t.title;
  document.getElementById('mini-artist').textContent = t.artist;
  setPlayIcons(false);
}

function setPlayIcons(paused) {
  const playPath = paused
    ? '<polygon points="5 3 19 12 5 21"/>'
    : '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>';
  document.getElementById('mini-play-ico').innerHTML = playPath;
  document.getElementById('main-play-ico').innerHTML = playPath;
}

function highlightPlaying(id) {
  document.querySelectorAll('.track-row').forEach(el => {
    const p = el.dataset.id == id;
    el.classList.toggle('is-playing', p);
    const num = el.querySelector('.track-num');
    const eq = el.querySelector('.eq-anim');
    if (num) num.style.display = p ? 'none' : '';
    if (eq) eq.style.display = p ? 'flex' : 'none';
    if (eq) eq.classList.toggle('paused', aud.paused);
  });
}

function togglePlay() {
  if (!aud.src) return;
  if (aud.paused) { aud.play(); setPlayIcons(false); document.querySelectorAll('.eq-anim').forEach(e=>e.classList.remove('paused')); }
  else { aud.pause(); setPlayIcons(true); document.querySelectorAll('.eq-anim').forEach(e=>e.classList.add('paused')); }
}

function nextTrack() {
  if (!queue.length) return;
  qIdx = shuffle ? Math.floor(Math.random()*queue.length) : (qIdx+1)%queue.length;
  playTrack(queue[qIdx].id);
}

function prevTrack() {
  if (!queue.length) return;
  if (aud.currentTime > 3) { aud.currentTime=0; return; }
  qIdx = shuffle ? Math.floor(Math.random()*queue.length) : (qIdx-1+queue.length)%queue.length;
  playTrack(queue[qIdx].id);
}

function toggleShuffle() {
  shuffle = !shuffle;
  document.getElementById('btn-shuffle').classList.toggle('on', shuffle);
  toast(shuffle ? '⇄ Lecture aléatoire activée' : 'Lecture aléatoire désactivée');
}

function toggleRepeat() {
  repeat = (repeat+1)%3;
  const btn = document.getElementById('btn-repeat');
  btn.classList.toggle('on', repeat>0);
  const msgs = ['Répétition désactivée','Répéter tout','Répéter cette piste'];
  toast(msgs[repeat]);
}

function seekTo(e) {
  const r = document.getElementById('prog-track').getBoundingClientRect();
  aud.currentTime = Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)) * aud.duration;
}

function setVol(v) { aud.volume = v/100; }
aud.volume = 0.8;

aud.addEventListener('timeupdate', () => {
  if (!aud.duration) return;
  const p = aud.currentTime/aud.duration*100;
  document.getElementById('prog-fill').style.width = p+'%';
  document.getElementById('t-cur').textContent = fmt(aud.currentTime);
  document.getElementById('t-tot').textContent = fmt(aud.duration);
});

aud.addEventListener('ended', () => {
  if (repeat===2) { aud.currentTime=0; aud.play(); }
  else nextTrack();
});

/* =================== PLAYLISTS =================== */
function openNewPl() {
  openSheet(`<div class="sheet-title">Nouvelle playlist</div>
    <div class="edit-form">
      <label class="edit-label">Nom</label>
      <input class="edit-input" id="newpl-in" placeholder="Ma playlist…" autofocus>
      <div class="edit-btns">
        <button class="ebtn ebtn-cancel" onclick="closeSheet()">Annuler</button>
        <button class="ebtn ebtn-save" onclick="createPl()">Créer</button>
      </div>
    </div>`);
  setTimeout(()=>document.getElementById('newpl-in')?.focus(),300);
}

function createPl() {
  const name = document.getElementById('newpl-in')?.value.trim();
  if (!name) return;
  const pl = { id:'PL'+Date.now(), name, trackIds:[] };
  playlists.push(pl);
  savePl(); renderPl(); closeSheet();
  toast(`Playlist <b>${name}</b> créée`);
}

function deletePl(id) {
  const pl = playlists.find(p=>p.id==id);
  if (!pl) return;
  openSheet(`<div class="sheet-title">Supprimer "${esc(pl.name)}" ?</div>
    <div class="edit-form">
      <p style="color:var(--text2);font-size:13px;margin-bottom:16px">Cette action est irréversible.</p>
      <div class="edit-btns">
        <button class="ebtn ebtn-cancel" onclick="closeSheet()">Annuler</button>
        <button class="ebtn ebtn-save" style="background:var(--red)" onclick="confirmDeletePl('${id}')">Supprimer</button>
      </div>
    </div>`);
}

function confirmDeletePl(id) {
  playlists = playlists.filter(p=>p.id!=id);
  savePl(); renderPl(); closeSheet();
  toast('Playlist supprimée');
}

function addToPlaylist(trackId) {
  if (!playlists.length) {
    toast('Crée d\'abord une playlist');
    return;
  }
  const items = playlists.map(p => {
    const has = p.trackIds.includes(trackId);
    return `<div class="sheet-item" onclick="doAddToPl('${trackId}','${p.id}')">
      <div class="sheet-ico">${has?'✓':'＋'}</div>
      <div><div class="sheet-item-text">${esc(p.name)}</div><div class="sheet-item-sub">${p.trackIds.length} morceaux${has?' · déjà ajouté':''}</div></div>
    </div>`;
  }).join('');
  openSheet(`<div class="sheet-title">Ajouter à une playlist</div>${items}`);
}

function doAddToPl(trackId, plId) {
  const pl = playlists.find(p=>p.id==plId);
  if (!pl) return;
  if (pl.trackIds.includes(trackId)) { toast('Déjà dans la playlist'); closeSheet(); return; }
  pl.trackIds.push(trackId);
  savePl();
  const t = tracks.find(t=>t.id==trackId);
  closeSheet();
  toast(`<b>${t?.title}</b> ajouté à "${pl.name}"`);
  if (activePlId==plId) renderPlDetail(plId);
}

function removeFromPl(trackId, plId) {
  const pl = playlists.find(p=>p.id==plId);
  if (!pl) return;
  pl.trackIds = pl.trackIds.filter(id=>id!=trackId);
  savePl(); closeSheet();
  renderPlDetail(plId);
  toast('Retiré de la playlist');
}

function playPlaylist() {
  const pl = playlists.find(p=>p.id==activePlId);
  if (!pl||!pl.trackIds.length) { toast('Playlist vide'); return; }
  const plTracks = pl.trackIds.map(tid=>tracks.find(t=>t.id==tid)).filter(Boolean);
  queue = plTracks; qIdx=0;
  playTrack(queue[0].id, 'pl:'+activePlId);
}

function shufflePlaylist() {
  const pl = playlists.find(p=>p.id==activePlId);
  if (!pl||!pl.trackIds.length) { toast('Playlist vide'); return; }
  const plTracks = pl.trackIds.map(tid=>tracks.find(t=>t.id==tid)).filter(Boolean);
  queue = [...plTracks].sort(()=>Math.random()-.5);
  qIdx=0;
  playTrack(queue[0].id, 'pl:'+activePlId);
}

/* =================== TRACK SHEET =================== */
function openTrackSheet(id, context) {
  const t = tracks.find(t=>t.id==id);
  if (!t) return;
  const isPl = context&&context.startsWith('pl:');
  const plId = isPl ? context.split(':')[1] : null;
  openSheet(`
    <div class="sheet-title">${esc(t.title)}</div>
    <div class="sheet-item" onclick="editTrack('${id}')">
      <div class="sheet-ico">✏️</div>
      <div><div class="sheet-item-text">Modifier titre / artiste</div></div>
    </div>
    <div class="sheet-item" onclick="addToPlaylist('${id}')">
      <div class="sheet-ico">📋</div>
      <div><div class="sheet-item-text">Ajouter à une playlist</div><div class="sheet-item-sub">${playlists.length} playlist${playlists.length!==1?'s':''}</div></div>
    </div>
    <div class="sheet-item" onclick="tapHeart({stopPropagation:()=>{}},${JSON.stringify(id)});document.querySelector('.btn-heart[data-hid='+JSON.stringify(id)+']')?.click();closeSheet()">
      <div class="sheet-ico">${favorites.has(id)?'❤️':'🤍'}</div>
      <div><div class="sheet-item-text">${favorites.has(id)?'Retirer des favoris':'Ajouter aux favoris'}</div></div>
    </div>
    ${isPl?`<div class="sheet-sep"></div><div class="sheet-item danger" onclick="removeFromPl('${id}','${plId}')"><div class="sheet-ico">🗑️</div><div><div class="sheet-item-text">Retirer de la playlist</div></div></div>`:''}
  `);
}

function editTrack(id) {
  const t = tracks.find(t=>t.id==id);
  if (!t) return;
  openSheet(`
    <div class="sheet-title">Modifier le morceau</div>
    <div class="edit-form">
      <label class="edit-label">Titre</label>
      <input class="edit-input" id="edit-title" value="${esc(t.title)}">
      <label class="edit-label">Artiste</label>
      <input class="edit-input" id="edit-artist" value="${esc(t.artist)}">
      <div class="edit-btns">
        <button class="ebtn ebtn-cancel" onclick="closeSheet()">Annuler</button>
        <button class="ebtn ebtn-save" onclick="saveTrackEdit('${id}')">Enregistrer</button>
      </div>
    </div>
  `);
  setTimeout(()=>document.getElementById('edit-title')?.focus(),300);
}

function saveTrackEdit(id) {
  const t = tracks.find(t=>t.id==id);
  if (!t) return;
  const newTitle = document.getElementById('edit-title')?.value.trim();
  const newArtist = document.getElementById('edit-artist')?.value.trim();
  if (newTitle) t.title = newTitle;
  if (newArtist) t.artist = newArtist;
  closeSheet();
  renderLib(); renderFavs();
  if (activePlId) renderPlDetail(activePlId);
  if (id===nowId) {
    document.getElementById('mini-title').textContent = t.title;
    document.getElementById('mini-artist').textContent = t.artist;
  }
  toast('Morceau modifié');
}

/* =================== SHEET =================== */
function openSheet(html) {
  document.getElementById('sheet-content').innerHTML = html;
  document.getElementById('sheet-bd').classList.add('open');
}

function closeSheet(e) {
  if (e && e.target !== document.getElementById('sheet-bd')) return;
  document.getElementById('sheet-bd').classList.remove('open');
}

/* =================== TOAST =================== */
let _toastTimer;
function toast(msg) {
  const el = document.getElementById('toast');
  el.innerHTML = msg;
  el.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(()=>el.classList.remove('show'), 2400);
}
