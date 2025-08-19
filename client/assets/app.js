// Minimal client app — handles auth and basic calls
const API_BASE = (localStorage.getItem('apiBase') || 'http://localhost:3001');

function qs(sel){return document.querySelector(sel)}
function setYear(){const y=qs('#year'); if(y) y.textContent = new Date().getFullYear()}
setYear();

// Auth
async function login(email,password){
  const res = await fetch(`${API_BASE}/api/auth/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})});
  const data = await res.json();
  if(!res.ok) throw new Error(data.message||'Login failed');
  localStorage.setItem('token', data.token);
  localStorage.setItem('me', JSON.stringify(data.user));
  location.href = './dashboard.html';
}

async function signup(name,email,password){
  const res = await fetch(`${API_BASE}/api/auth/register`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,email,password})});
  const data = await res.json();
  if(!res.ok) throw new Error(data.message||'Signup failed');
  localStorage.setItem('token', data.token);
  localStorage.setItem('me', JSON.stringify(data.user));
  location.href = './dashboard.html';
}

function me(){
  try{return JSON.parse(localStorage.getItem('me')||'null')}catch(e){return null}
}
function token(){return localStorage.getItem('token')}

// Forms
document.addEventListener('DOMContentLoaded',()=>{
  const lf = qs('#login-form');
  if(lf){
    lf.addEventListener('submit', async (e)=>{
      e.preventDefault();
      const email = lf.email.value.trim();
      const password = lf.password.value;
      const err = qs('#login-error');
      try{ await login(email,password); }
      catch(e){ err.textContent = e.message; err.classList.remove('hidden'); }
    });
  }
  const sf = qs('#signup-form');
  if(sf){
    sf.addEventListener('submit', async (e)=>{
      e.preventDefault();
      const name = sf.name.value.trim();
      const email = sf.email.value.trim();
      const password = sf.password.value;
      const err = qs('#signup-error');
      try{ await signup(name,email,password); }
      catch(e){ err.textContent = e.message; err.classList.remove('hidden'); }
    });
  }

  // Dashboard
  if(location.pathname.endsWith('dashboard.html')){
    const user = me();
    if(!user){ location.href = './login.html'; return; }
    qs('#welcome').textContent = `Hi, ${user.name}`;
    qs('#logout').addEventListener('click', (e)=>{
      e.preventDefault();
      localStorage.removeItem('token'); localStorage.removeItem('me');
      location.href = './';
    });
    loadDashboard();
  }
});

async function loadDashboard(){
  try{
    const headers = {'Authorization': `Bearer ${token()}`};
    const [meRes, sRes, aRes] = await Promise.all([
      fetch(`${API_BASE}/api/me`,{headers}), 
      fetch(`${API_BASE}/api/surveys`,{headers}), 
      fetch(`${API_BASE}/api/activity`,{headers})
    ]);
    const meData = await meRes.json();
    const surveys = await sRes.json();
    const activity = await aRes.json();
    qs('#balance').textContent = `$${(meData.balance||0).toFixed(2)}`;

    const list = qs('#surveys');
    list.innerHTML = '';
    surveys.forEach(sv=>{
      const el = document.createElement('div');
      el.className='survey';
      el.innerHTML = `
        <div class="meta">
          <span class="title">${sv.title}</span>
          <span class="tiny">${sv.length} min • ${sv.country||'Any'} • ${sv.category}</span>
        </div>
        <div class="row">
          <span class="big">$${sv.reward.toFixed(2)}</span>
          <a href="#" class="btn btn-primary btn-take" data-id="${sv.id}">Start</a>
        </div>`;
      el.querySelector('.btn-take').addEventListener('click', async (e)=>{
        e.preventDefault();
        await fetch(`${API_BASE}/api/surveys/attempts`,{method:'POST', headers:{'Content-Type':'application/json','Authorization':`Bearer ${token()}`}, body:JSON.stringify({surveyId: sv.id})});
        alert('Attempt recorded (demo). In production this would open a partner link.');
        await loadDashboard();
      });
      list.appendChild(el);
    });

    const alist = qs('#activity');
    alist.innerHTML = '';
    activity.forEach(a=>{
      const el = document.createElement('div');
      el.className='survey';
      el.innerHTML = `
        <div class="meta">
          <span class="title">${a.type}</span>
          <span class="tiny">${new Date(a.at).toLocaleString()} • ${a.note||''}</span>
        </div>
        <div class="row">
          <span class="big">${a.amount>0?'+':''}$${a.amount.toFixed(2)}</span>
        </div>`;
      alist.appendChild(el);
    });

    const payout = document.getElementById('btn-payout');
    if(payout){
      payout.addEventListener('click', async (e)=>{
        e.preventDefault();
        const res = await fetch(`${API_BASE}/api/payouts/request`,{method:'POST', headers:{'Authorization':`Bearer ${token()}`}});
        const data = await res.json();
        alert(data.message || 'Requested (demo)');
        await loadDashboard();
      });
    }

  }catch(e){
    console.error(e);
    alert('Failed to load dashboard. Is the server running?');
  }
}
