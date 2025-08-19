import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import Database from 'better-sqlite3';
import { nanoid } from 'nanoid';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const ORIGIN = process.env.CORS_ORIGIN || '*';
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret';
const DB_PATH = process.env.DATABASE_URL || './data.db';

app.use(helmet());
app.use(cors({ origin: ORIGIN, credentials: true }));
app.use(express.json());
app.use(morgan('tiny'));

// ---- DB INIT ----
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS users(
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    pass TEXT NOT NULL,
    balance REAL NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS surveys(
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    length INTEGER NOT NULL,
    reward REAL NOT NULL,
    country TEXT,
    category TEXT,
    active INTEGER NOT NULL DEFAULT 1
  );
  CREATE TABLE IF NOT EXISTS attempts(
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    survey_id TEXT NOT NULL,
    status TEXT NOT NULL,
    amount REAL NOT NULL DEFAULT 0,
    at TEXT NOT NULL
  );
`);

// seed surveys if empty
const surveyCount = db.prepare('SELECT COUNT(*) as c FROM surveys').get().c;
if(surveyCount === 0){
  const seed = db.prepare('INSERT INTO surveys (id,title,length,reward,country,category,active) VALUES (?,?,?,?,?,?,1)');
  [
    ['Consumer electronics study', 10, 0.75, 'US', 'Shopping'],
    ['Food delivery habits', 7, 0.60, 'Any', 'Food'],
    ['Mobile game test (fun!)', 12, 1.10, 'Any', 'Gaming'],
    ['Streaming services review', 9, 0.85, 'CA/US', 'Entertainment']
  ].forEach(([title,length,reward,country,category])=>{
    seed.run(nanoid(), title, length, reward, country, category);
  });
}

// ---- Helpers ----
function auth(req,res,next){
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if(!token) return res.status(401).json({message:'Missing token'});
  try{
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  }catch(e){
    return res.status(401).json({message:'Invalid token'});
  }
}

function publicUser(u){ return { id: u.id, name: u.name, email: u.email, balance: u.balance }; }

// ---- Routes ----
app.get('/',(req,res)=>res.json({ok:true, name:'PrimeStyle API'}));

app.post('/api/auth/register', (req,res)=>{
  const { name, email, password } = req.body || {};
  if(!name || !email || !password) return res.status(400).json({message:'Missing fields'});
  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if(exists) return res.status(409).json({message:'Email already registered'});
  const id = nanoid();
  const hash = bcrypt.hashSync(password, 10);
  const created_at = new Date().toISOString();
  db.prepare('INSERT INTO users (id,name,email,pass,created_at) VALUES (?,?,?,?,?)').run(id, name, email, hash, created_at);
  const token = jwt.sign({ id, email, name }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: { id, name, email, balance: 0 } });
});

app.post('/api/auth/login', (req,res)=>{
  const { email, password } = req.body || {};
  if(!email || !password) return res.status(400).json({message:'Missing credentials'});
  const u = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if(!u) return res.status(401).json({message:'Invalid email or password'});
  const ok = bcrypt.compareSync(password, u.pass);
  if(!ok) return res.status(401).json({message:'Invalid email or password'});
  const token = jwt.sign({ id: u.id, email: u.email, name: u.name }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: publicUser(u) });
});

app.get('/api/me', auth, (req,res)=>{
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if(!u) return res.status(404).json({message:'User not found'});
  res.json(publicUser(u));
});

app.get('/api/surveys', auth, (req,res)=>{
  const list = db.prepare('SELECT * FROM surveys WHERE active = 1').all();
  res.json(list);
});

app.post('/api/surveys/attempts', auth, (req,res)=>{
  const { surveyId } = req.body || {};
  if(!surveyId) return res.status(400).json({message:'surveyId required'});
  const s = db.prepare('SELECT * FROM surveys WHERE id = ? AND active = 1').get(surveyId);
  if(!s) return res.status(404).json({message:'Survey not found'});
  // Demo: instantly credit half reward as "attempt", in production use webhook/callback
  const id = nanoid();
  const at = new Date().toISOString();
  const amount = Math.round((s.reward * 0.5) * 100) / 100;
  db.prepare('INSERT INTO attempts (id,user_id,survey_id,status,amount,at) VALUES (?,?,?,?,?,?)')
    .run(id, req.user.id, s.id, 'attempted', amount, at);
  db.prepare('UPDATE users SET balance = balance + ? WHERE id = ?').run(amount, req.user.id);
  res.json({ok:true, credited: amount});
});

app.get('/api/activity', auth, (req,res)=>{
  const acts = db.prepare('SELECT * FROM attempts WHERE user_id = ? ORDER BY at DESC LIMIT 25').all(req.user.id)
    .map(a=>({id:a.id, type:a.status==='payout'?'Payout':'Survey attempt', amount:a.amount, at:a.at, note: a.status==='payout'?'Manual payout request':null}));
  res.json(acts);
});

app.post('/api/payouts/request', auth, (req,res)=>{
  // For demo, convert entire balance to payout and reset to 0
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if(!u) return res.status(404).json({message:'User not found'});
  if(u.balance < 1) return res.status(400).json({message:'Minimum payout is $1.00 in demo'});
  const id = nanoid();
  const at = new Date().toISOString();
  const amount = u.balance;
  db.prepare('INSERT INTO attempts (id,user_id,survey_id,status,amount,at) VALUES (?,?,?,?,?,?)')
    .run(id, u.id, 'payout', 'payout', -amount, at);
  db.prepare('UPDATE users SET balance = 0 WHERE id = ?').run(u.id);
  res.json({ok:true, message:`Payout requested for $${amount.toFixed(2)} (demo)`});
});

app.listen(PORT, ()=>{
  console.log(`API running on http://localhost:${PORT}`);
});
