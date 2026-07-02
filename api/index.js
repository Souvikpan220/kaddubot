// api/index.js - BRONX OSINT V100 ULTRA PRIME - ALL IN ONE
const express = require('express');
const axios = require('axios');
const app = express();

const REAL_API_BASE = 'https://ft-osint-api.duckdns.org/api';
const REAL_API_KEY = process.env.REAL_API_KEY || 'bot-new';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'jeet';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'lalukalu';
const MASTER_API_KEY = process.env.MASTER_API_KEY || 'MoonWitch' + Math.random().toString(36).substring(2, 10).toUpperCase();

let keyStorage = {};
let customAPIs = [];
let requestLogs = [];
let adminSessions = {};
let permanentTokens = {};
let bannedIPs = [];
let cooldownTimers = {};

// ========== STORAGE (GITHUB GIST - 100% PERMANENT) ==========
const GIST_ID = process.env.GIST_ID || '386977dba3df1d39cd86765a98a4835d';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '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';

async function saveToStorage() {
    try {
        const fullData = { 
            keys: keyStorage, 
            apis: customAPIs, 
            tokens: permanentTokens, 
            banned: bannedIPs, 
            logs: requestLogs.slice(-200)
        };
        
        await axios.patch(`https://api.github.com/gists/${GIST_ID}`, {
            files: { 'bronx_data.json': { content: JSON.stringify(fullData, null, 2) } }
        }, {
            headers: { 'Authorization': `token ${GITHUB_TOKEN}`, 'Content-Type': 'application/json' }
        });
        
        console.log('💾 Saved to GitHub! Keys:', Object.keys(keyStorage).length, 'APIs:', customAPIs.length, 'Logs:', requestLogs.length);
    } catch (e) { console.log('Save err:', e.message); }
}

async function loadFromStorage() {
    try {
        const res = await axios.get(`https://api.github.com/gists/${GIST_ID}`, {
            headers: { 'Authorization': `token ${GITHUB_TOKEN}` }
        });
        
        if (res.data && res.data.files && res.data.files['bronx_data.json']) {
            const d = JSON.parse(res.data.files['bronx_data.json'].content);
            
            if (d.keys && typeof d.keys === 'object' && Object.keys(d.keys).length > 0) {
                keyStorage = d.keys;
                if (!keyStorage[MASTER_API_KEY]) {
                    keyStorage[MASTER_API_KEY] = createMasterKey();
                }
            }
            
            if (d.apis && Array.isArray(d.apis) && d.apis.length > 0) {
                customAPIs = d.apis;
            }
            
            if (d.tokens && typeof d.tokens === 'object') {
                permanentTokens = d.tokens;
                Object.entries(permanentTokens).forEach(([t]) => { 
                    adminSessions[t] = { 
                        expiresAt: Date.now() + (365*24*60*60*1000), 
                        permanent: true 
                    }; 
                });
            }
            
            if (d.banned && Array.isArray(d.banned)) {
                bannedIPs = d.banned;
            }
            
            if (d.logs && Array.isArray(d.logs)) {
                requestLogs = d.logs;
            }
            
            console.log('📥 Loaded! Keys:', Object.keys(keyStorage).length, 'APIs:', customAPIs.length, 'Logs:', requestLogs.length);
            return Object.keys(keyStorage).length > 0;
        }
        return false;
    } catch (e) { 
        console.log('Load err:', e.message); 
        return false; 
    }
}

function scheduleSave() { 
    setTimeout(async () => { await saveToStorage(); }, 2000); 
}
setInterval(() => scheduleSave(), 2 * 60 * 1000);

// ========== HELPERS ==========
function getIndiaTime() { return new Date(new Date().getTime() + (5.5 * 60 * 60 * 1000)); }
function getIndiaDate() { return getIndiaTime().toISOString().split('T')[0]; }
function getIndiaDateTime() { return getIndiaTime().toISOString().replace('T', ' ').substring(0, 19); }
function isKeyExpired(d) { if (!d || d === 'LIFETIME') return false; return getIndiaTime() > new Date(d); }
function parseExpiryDate(s) { if (!s || s === 'LIFETIME') return null; const p = s.split('-'); if (p.length === 3) return p[0].length === 4 ? new Date(+p[0], +p[1] - 1, +p[2], 23, 59, 59) : new Date(+p[2], +p[1] - 1, +p[0], 23, 59, 59); const d = new Date(s); return isNaN(d.getTime()) ? null : d; }
function checkCooldown(k) { const kd = keyStorage[k]; if (!kd || !kd.cooldown) return { allowed: true }; const n = Date.now(); if (cooldownTimers[k] && (n - cooldownTimers[k]) < (kd.cooldown * 1000)) { return { allowed: false, remaining: Math.ceil((kd.cooldown * 1000 - (n - cooldownTimers[k])) / 1000) }; } cooldownTimers[k] = n; return { allowed: true }; }
function checkKeyValid(k) { if (!k) return { valid: false, error: 'Missing key' }; const kd = keyStorage[k]; if (!kd) return { valid: false, error: 'Key not found' }; if (kd.expiry && isKeyExpired(kd.expiry)) return { valid: false, error: 'Expired' }; if (!kd.unlimited && kd.used >= kd.limit) return { valid: false, error: 'Limit reached' }; const cd = checkCooldown(k); if (!cd.allowed) return { valid: false, error: 'Cooldown ' + cd.remaining + 's' }; return { valid: true, keyData: kd }; }
function incrementKeyUsage(k) { if (keyStorage[k] && !keyStorage[k].unlimited) { keyStorage[k].used++; if (keyStorage[k].used % 3 === 0) scheduleSave(); } }
function checkKeyScope(kd, ep) { if (!kd || !kd.scopes) return { valid: false }; if (kd.scopes.includes('*')) return { valid: true }; if (kd.scopes.includes(ep)) return { valid: true }; if (ep.startsWith('c/') && kd.scopes.includes('custom')) return { valid: true }; return { valid: false }; }
function generateToken() { const c = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'; let t = ''; for (let i = 0; i < 32; i++) t += c.charAt(Math.floor(Math.random() * c.length)); return t; }
function isAdminAuth(t) { if (!t) return false; if (adminSessions[t]) { if (adminSessions[t].permanent) return true; if (Date.now() < adminSessions[t].expiresAt) return true; delete adminSessions[t]; delete permanentTokens[t]; } return false; }
function isIPBanned(ip) { return ip && ip !== 'unknown' && bannedIPs.includes(ip); }
function banIP(ip) { if (ip && ip !== 'unknown' && !bannedIPs.includes(ip)) { bannedIPs.push(ip); scheduleSave(); } }
function unbanIP(ip) { const i = bannedIPs.indexOf(ip); if (i > -1) { bannedIPs.splice(i, 1); scheduleSave(); } }
function sanitizeResponse(d) { if (!d) return d; try { const c = JSON.parse(JSON.stringify(d)); delete c.credit; delete c.truecaller_name; delete c.cached; delete c.cached_at; delete c.api_by; delete c.by; delete c.channel; delete c.developer; delete c.api_key; delete c.real_url; delete c.source_url; delete c.internal_id; delete c.response_time_ms; delete c.quota_used; if(c.meta){delete c.meta.api_by; delete c.meta.response_time_ms; delete c.meta.quota_used; if(Object.keys(c.meta).length===0)delete c.meta;} c.powered_by = "MoonWitch"; return c; } catch (e) { return d; } }
function esc(s) { if (!s) return ''; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;'); }
function detectBrowser(ua) { if(!ua) return {name:'?',device:'?'}; let n='?'; if(ua.includes('Firefox')) n='Firefox'; else if(ua.includes('Chrome')) n='Chrome'; else if(ua.includes('Safari')) n='Safari'; let d='Desktop'; if(ua.includes('Mobile')) d='Mobile'; return {name:n,device:d}; }
function logRequest(key, ep, param, status, ip, ua) { const b = detectBrowser(ua); requestLogs.push({ timestamp: getIndiaDateTime(), key: key ? key.substring(0, 8) + '***' : '?', endpoint: ep, param: param ? param.substring(0, 20) : '', status, ip: ip || '?', browser: b.name, device: b.device }); if (requestLogs.length > 300) requestLogs = requestLogs.slice(-300); if (requestLogs.length % 5 === 0) scheduleSave(); }
function createMasterKey() { return { name:'👑 OWNER',scopes:['*'],type:'owner',limit:999999,used:0,cooldown:0,expiry:null,expiryStr:'LIFETIME',created:getIndiaDateTime(),unlimited:true,hidden:true }; }

function initDefaultData() {
    const now = getIndiaDateTime(); keyStorage = {}; keyStorage[MASTER_API_KEY] = createMasterKey();
    [{ key:'MoonWitch',name:'🎁 Premium',scopes:['*'],limit:1000,cooldown:0,expiry:'31-12-2027' },{ key:'MoonWitch2',name:'🎁 Basic',scopes:['number','aadhar','pan','upi'],limit:500,cooldown:2,expiry:'30-06-2027' },{ key:'MoonWitch3',name:'🎁 Starter',scopes:['number','ip','pincode'],limit:200,cooldown:1,expiry:'31-12-2027' },{ key:'MoonWitch4',name:'🎁 OP',scopes:['*'],limit:999,cooldown:0,expiry:'31-12-2027' },{ key:'MoonWitch5',name:'🎁 Pro',scopes:['*'],limit:5000,cooldown:0,expiry:'31-12-2028' },{ key:'MoonWitch6',name:'🎁 Bomber',scopes:['number','custom'],limit:300,cooldown:3,expiry:'31-12-2027' }].forEach(d => { keyStorage[d.key] = { name:d.name,scopes:d.scopes,type:'demo',limit:d.limit,used:0,cooldown:d.cooldown||0,expiry:parseExpiryDate(d.expiry),expiryStr:d.expiry,created:now,unlimited:false,hidden:false }; });
}

function initCustomAPIs() {
    customAPIs = [
        { id:1,name:'Number Info',endpoint:'number-advanced',param:'num',example:'9876543210',visible:true,realAPI:'https://num-tg-info-api.vercel.app/info?number={param}' },
        { id:2,name:'Vehicle RC',endpoint:'rc-details',param:'ca_number',example:'MH02FZ0555',visible:true,realAPI:'https://bronx-rc-api.vercel.app/bronx?ca_number={param}' },
        { id:3,name:'Aadhar',endpoint:'aadhar-verify',param:'aadhar',example:'393933081942',visible:true,realAPI:'https://bronx-king-vip999.vercel.app/api/aadhaar?num={param}' },
        { id:4,name:'Email',endpoint:'email-lookup',param:'mail',example:'user@gmail.com',visible:true,realAPI:'https://bronx-king-mail-opi.vercel.app/mail={param}' },
        { id:5,name:'Telegram',endpoint:'telegram-scan',param:'id',example:'7530266953',visible:true,realAPI:'https://bronx-tg-king-bro.vercel.app/tg?key=BRONXop&query={param}' },
        { id:6,name:'SMS Bomber',endpoint:'sms-bomber',param:'number',example:'1234567890',visible:true,realAPI:'https://bronx-sms-api-ulimate.vercel.app/api/key-bronx-paid-vip?number={param}&counter=10' },
        { id:7,name:'Number Backup',endpoint:'num-op',param:'num',example:'9876543210',visible:true,realAPI:'https://tfqdeadlo-inddataapi.hf.space/search?mobile={param}' },
    ];
}

const endpoints = {
    number:{p:'num',i:'📱',e:'9876543210',d:'Mobile Lookup',c:'phone'},aadhar:{p:'num',i:'🆔',e:'393933081942',d:'Aadhaar Details',c:'phone'},name:{p:'name',i:'🔍',e:'abhiraaj',d:'Name Search',c:'phone'},numv2:{p:'num',i:'📱',e:'6205949840',d:'Number v2',c:'phone'},adv:{p:'num',i:'📱',e:'9876543210',d:'Advanced Intel',c:'phone'},adharfamily:{p:'num',i:'👨‍👩‍👧‍👦',e:'984154610245',d:'Family Details',c:'phone'},adharration:{p:'num',i:'📋',e:'701984830542',d:'Ration Card',c:'phone'},imei:{p:'imei',i:'📱',e:'357817383506298',d:'IMEI Info',c:'phone'},calltracer:{p:'num',i:'📞',e:'9876543210',d:'Call Tracer',c:'phone'},upi:{p:'upi',i:'💰',e:'example@ybl',d:'UPI Lookup',c:'finance'},ifsc:{p:'ifsc',i:'🏦',e:'SBIN0001234',d:'IFSC Details',c:'finance'},pan:{p:'pan',i:'📄',e:'AXDPR2606K',d:'PAN Card',c:'finance'},pincode:{p:'pin',i:'📍',e:'110001',d:'Pincode',c:'location'},ip:{p:'ip',i:'🌐',e:'8.8.8.8',d:'IP Lookup',c:'location'},vehicle:{p:'vehicle',i:'🚗',e:'MH02FZ0555',d:'Vehicle Info',c:'vehicle'},rc:{p:'owner',i:'📋',e:'UP92P2111',d:'RC Owner',c:'vehicle'},ff:{p:'uid',i:'🎮',e:'123456789',d:'Free Fire',c:'gaming'},bgmi:{p:'uid',i:'🎮',e:'5121439477',d:'BGMI',c:'gaming'},insta:{p:'username',i:'📸',e:'cristiano',d:'Instagram',c:'social'},git:{p:'username',i:'💻',e:'ftgamer2',d:'GitHub',c:'social'},tg:{p:'info',i:'📲',e:'JAUUOWNER',d:'Telegram',c:'social'},tgidinfo:{p:'id',i:'📲',e:'7530266953',d:'TG ID Info',c:'social'},snap:{p:'username',i:'👻',e:'priyapanchal272',d:'Snapchat',c:'social'},pk:{p:'num',i:'🇵🇰',e:'03331234567',d:'Pakistan',c:'pakistan'},pkv2:{p:'num',i:'🇵🇰',e:'3359736848',d:'Pakistan v2',c:'pakistan'}
};

const apiExamples = {
    number:{req:'GET /api/key-kaddu/number?key=YOUR_KEY&num=7307841587',res:'{"success":true,"number":"7307841587","results":[{"name":"Nemsingh","mobile":"7307841587","circle":"JIO UPE"}]}'},
    aadhar:{req:'GET /api/key-kaddu/aadhar?key=YOUR_KEY&num=393933081942',res:'{"success":true,"aadhar":"393933081942","results":[{"name":"J Vinod","phoneNumber":"9490160194"}]}'},
    name:{req:'GET /api/key-kaddu/name?key=YOUR_KEY&name=abhiraaj',res:'{"success":true,"name":"abhiraaj","results":[{"name":"ABHIRAAJ GAWADE","phoneNumber":"9823796702"}]}'},
    upi:{req:'GET /api/key-kaddu/upi?key=YOUR_KEY&upi=example@ybl',res:'{"success":true,"upi_id":"example@ybl","account_name":"MURENDRA SARABU","bank":"Union Bank"}'},
    ifsc:{req:'GET /api/key-kaddu/ifsc?key=YOUR_KEY&ifsc=SBIN0001234',res:'{"success":true,"ifsc":"SBIN0001234","bank":"State Bank of India","branch":"HAJIGANJ"}'},
    pincode:{req:'GET /api/key-kaddu/pincode?key=YOUR_KEY&pin=110001',res:'{"success":true,"pincode":"110001","state":"Delhi","district":"Central Delhi"}'},
    ip:{req:'GET /api/key-kaddu/ip?key=YOUR_KEY&ip=8.8.8.8',res:'{"success":true,"ip":"8.8.8.8","country":"United States","city":"Mountain View"}'},
    leakinfo:{req:'GET /api/key-kaddu/leakinfo?key=YOUR_KEY&info=email@example.com',res:'{"status":"success","data":{"rc_number":"MH02FZ0555","owner_name":"SHAH RUKH KHAN"}}'},
    vehicle:{req:'GET /api/key-kaddu/vehicle?key=YOUR_KEY&vehicle=MH02FZ0555',res:'{"status":"success","data":{"rc_number":"MH02FZ0555","owner_name":"SHAH RUKH KHAN"}}'},
    ff:{req:'GET /api/key-kaddu/ff?key=YOUR_KEY&uid=123456789',res:'{"success":true,"uid":"123456789","info":{"Nickname":"MoonWitch","Level":"67"}}'},
    insta:{req:'GET /api/key-kaddu/insta?key=YOUR_KEY&username=cristiano',res:'{"success":true,"username":"cristiano","profile":{"followers":672571267}}'},
    tg:{req:'GET /api/key-kaddu/tg?key=YOUR_KEY&info=JAUUOWNER',res:'{"success":true,"info":"JAUUOWNER","number":"9627507420","country":"India"}'},
};

app.use(express.json({limit:'50mb'})); app.use(express.urlencoded({extended:true,limit:'50mb'}));
app.use((req,res,next)=>{res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');res.setHeader('Access-Control-Allow-Headers','Content-Type,x-api-key,x-admin-token');if(req.method==='OPTIONS')return res.status(200).end();next();});
app.use((req,res,next)=>{req.clientIP=req.headers['x-forwarded-for']?.split(',')[0]?.trim()||'unknown';if(isIPBanned(req.clientIP)&&!req.path.startsWith('/admin')&&!req.path.startsWith('/docs'))return res.status(403).json({error:'IP Banned'});next();});

app.get('/',(req,res)=>{try{res.send(renderHome())}catch(e){res.status(500).send('Error')}});
app.get('/docs',(req,res)=>{try{res.send(renderDocs())}catch(e){res.status(500).send('Error')}});
app.get('/test',(req,res)=>{res.json({status:'✅ MoonWitch OSINT V100',keys:Object.keys(keyStorage).filter(k=>!keyStorage[k]?.hidden).length})});
app.get('/key-info',(req,res)=>{const k=req.query.key;if(!k)return res.json({error:'Missing key'});const kd=keyStorage[k];if(!kd||kd.hidden)return res.json({error:'Not found'});res.json({key:k.substring(0,4)+'****',owner:kd.name,limit:kd.unlimited?'∞':kd.limit,used:kd.used,expiry:kd.expiryStr||'LIFETIME'})});
app.get('/api/custom/:ep',async(req,res)=>{try{const api=customAPIs.find(a=>a.endpoint===req.params.ep&&a.visible);if(!api)return res.json({error:'Not found'});const key=req.query.key;if(!key)return res.json({error:'Key required'});const kc=checkKeyValid(key);if(!kc.valid)return res.json({error:kc.error});const pv=req.query[api.param]||req.query.number;if(!pv)return res.json({error:'Missing param'});let url=api.realAPI.replace(/\{param\}/gi,encodeURIComponent(pv));if(req.query.count)url=url.replace('counter=10','counter='+req.query.count);const resp=await axios.get(url,{timeout:30000});incrementKeyUsage(key);logRequest(key,'c/'+req.params.ep,pv,'success',req.clientIP,req.userAgent);res.json({...sanitizeResponse(resp.data),api_info:{remaining:kc.keyData?.unlimited?'∞':Math.max(0,(kc.keyData?.limit||0)-(kc.keyData?.used||0))}})}catch(e){res.json({error:'API error'})}});
app.get('/api/key-kaddu/:ep',async(req,res)=>{try{const ep=req.params.ep;if(!endpoints[ep])return res.json({error:'Not found'});const key=req.query.key;if(!key)return res.json({error:'Key required'});const kc=checkKeyValid(key);if(!kc.valid)return res.json({error:kc.error});const sc=checkKeyScope(kc.keyData,ep);if(!sc.valid)return res.json({error:'Scope denied'});const pv=req.query[endpoints[ep].p];if(!pv)return res.json({error:'Missing '+endpoints[ep].p});const url=`${REAL_API_BASE}/${ep}?key=${REAL_API_KEY}&${endpoints[ep].p}=${encodeURIComponent(pv)}`;const resp=await axios.get(url,{timeout:30000});incrementKeyUsage(key);logRequest(key,ep,pv,'success',req.clientIP,req.userAgent);res.json({...sanitizeResponse(resp.data),api_info:{remaining:keyStorage[key]?.unlimited?'∞':Math.max(0,(keyStorage[key]?.limit||0)-(keyStorage[key]?.used||0))}})}catch(e){res.json({error:'API error'})}});

app.get('/admin',(req,res)=>{try{const token=req.query.token||req.headers['x-admin-token'];if(token&&isAdminAuth(token))return res.send(renderAdmin(token));res.send(renderLogin())}catch(e){res.status(500).send('<h1>Error</h1>')}});
app.post('/admin/login',async(req,res)=>{const{username,password}=req.body;if(username===ADMIN_USERNAME&&password===ADMIN_PASSWORD){const token=generateToken();adminSessions[token]={expiresAt:Date.now()+(365*24*60*60*1000),permanent:true};permanentTokens[token]={createdAt:getIndiaDateTime()};scheduleSave();res.json({success:true,token,message:'Access Granted',redirect:'/admin?token='+token})}else res.json({success:false,error:'Invalid'})});
app.post('/admin/generate-key',async(req,res)=>{if(!isAdminAuth(req.headers['x-admin-token']||req.query.token))return res.json({e:'Unauthorized'});const{keyName,keyOwner,scopes,limit,cooldown,expiryDate,keyType,days}=req.body;if(!keyName||!keyOwner)return res.json({e:'Missing'});if(keyStorage[keyName])return res.json({e:'Exists'});let expiry=null,expiryStr=expiryDate||'LIFETIME';if(days&&!isNaN(days)){const d=new Date(getIndiaTime().getTime()+parseInt(days)*24*60*60*1000);expiry=d;expiryStr=d.toISOString().split('T')[0].split('-').reverse().join('-');}else if(expiryDate&&expiryDate!=='LIFETIME'){expiry=parseExpiryDate(expiryDate);expiryStr=expiryDate;}keyStorage[keyName]={name:keyOwner,scopes:scopes||['number'],type:keyType||'premium',limit:limit==='unlimited'?999999:(parseInt(limit)||100),used:0,cooldown:parseInt(cooldown)||0,expiry:expiry,expiryStr:expiryStr,created:getIndiaDateTime(),unlimited:(!days&&(!expiryDate||expiryDate==='LIFETIME'))||limit==='unlimited'||parseInt(limit)>=999999,hidden:false};scheduleSave();res.json({success:true})});
app.post('/admin/push-key',async(req,res)=>{if(!isAdminAuth(req.headers['x-admin-token']||req.query.token))return res.json({e:'Unauthorized'});const{keyName,days}=req.body;if(!keyStorage[keyName])return res.json({e:'Not found'});const d=parseInt(days)||30;const newExp=new Date(getIndiaTime().getTime()+d*24*60*60*1000);keyStorage[keyName].expiry=newExp;keyStorage[keyName].expiryStr=newExp.toISOString().split('T')[0].split('-').reverse().join('-');keyStorage[keyName].used=0;keyStorage[keyName].unlimited=false;scheduleSave();res.json({success:true,message:`Pushed ${d} days`})});
app.post('/admin/delete-key',async(req,res)=>{if(!isAdminAuth(req.headers['x-admin-token']||req.query.token))return res.json({e:'Unauthorized'});if(req.body.keyName===MASTER_API_KEY)return res.json({e:'Protected'});delete keyStorage[req.body.keyName];scheduleSave();res.json({success:true})});
app.post('/admin/reset-key-usage',async(req,res)=>{if(!isAdminAuth(req.headers['x-admin-token']||req.query.token))return res.json({e:'Unauthorized'});if(keyStorage[req.body.keyName]){keyStorage[req.body.keyName].used=0;scheduleSave();res.json({success:true})}else res.json({e:'Not found'})});
app.post('/admin/import-keys',async(req,res)=>{if(!isAdminAuth(req.headers['x-admin-token']||req.query.token))return res.json({e:'Unauthorized'});const{keys}=req.body;if(!keys||typeof keys!=='object')return res.json({e:'Invalid'});let imported=0;Object.entries(keys).forEach(([kn,kd])=>{if(kn===MASTER_API_KEY||keyStorage[kn])return;keyStorage[kn]={name:kd.name||'Imported',scopes:kd.scopes||['number'],type:kd.type||'imported',limit:kd.limit||100,used:kd.used||0,cooldown:kd.cooldown||0,expiry:kd.expiry||null,expiryStr:kd.expiryStr||'LIFETIME',created:kd.created||getIndiaDateTime(),unlimited:kd.unlimited||false,hidden:kd.hidden||false};imported++});scheduleSave();res.json({success:true,imported})});
// UNLIMITED CUSTOM API SLOTS
app.post('/admin/add-api',async(req,res)=>{if(!isAdminAuth(req.headers['x-admin-token']||req.query.token))return res.json({e:'Unauthorized'});const{name,endpoint,param,example,desc,realAPI}=req.body;if(!name||!endpoint)return res.json({e:'Missing fields'});const newId=customAPIs.length+1;customAPIs.push({id:newId,name,endpoint,param:param||'num',example:example||'9876543210',desc:desc||'',visible:true,realAPI:realAPI||''});scheduleSave();res.json({success:true,message:'API Added!',id:newId})});
app.post('/admin/delete-api',async(req,res)=>{if(!isAdminAuth(req.headers['x-admin-token']||req.query.token))return res.json({e:'Unauthorized'});const{id}=req.body;const idx=customAPIs.findIndex(a=>a.id===parseInt(id));if(idx>-1){customAPIs.splice(idx,1);scheduleSave();res.json({success:true})}else res.json({e:'Not found'})});
app.post('/admin/ban-ip',async(req,res)=>{if(!isAdminAuth(req.headers['x-admin-token']||req.query.token))return res.json({e:'Unauthorized'});const{ip}=req.body;if(!ip)return res.json({e:'Missing IP'});banIP(ip);scheduleSave();res.json({success:true})});
app.post('/admin/unban-ip',async(req,res)=>{if(!isAdminAuth(req.headers['x-admin-token']||req.query.token))return res.json({e:'Unauthorized'});const{ip}=req.body;if(!ip)return res.json({e:'Missing IP'});unbanIP(ip);scheduleSave();res.json({success:true})});
app.post('/admin/clear-logs',async(req,res)=>{if(!isAdminAuth(req.headers['x-admin-token']||req.query.token))return res.json({});requestLogs=[];scheduleSave();res.json({success:true})});
app.post('/admin/reset-all',async(req,res)=>{if(!isAdminAuth(req.headers['x-admin-token']||req.query.token))return res.json({e:'Unauthorized'});Object.keys(keyStorage).forEach(k=>{if(k!==MASTER_API_KEY)keyStorage[k].used=0});scheduleSave();res.json({success:true})});
app.use((req,res)=>{res.json({error:'Not found'})});

function renderLogin(){/* ... */ }
function renderAdmin(token){/* ... */ }
function renderDocs(){/* ... */ }

function renderHome(){try{const vapis=customAPIs.filter(a=>a.visible&&a.endpoint);const totalEndpoints=Object.keys(endpoints).length+vapis.length;const totalKeys=Object.keys(keyStorage).filter(k=>!keyStorage[k]?.hidden).length;const epsJSON=JSON.stringify(endpoints).replace(/</g,'\\u003c');let cardsHTML='';Object.entries(endpoints).forEach(([n,e])=>{cardsHTML+=`<div class="ep" style="--ac:#8b00ff" onclick="cp('${esc(n)}','${esc(e.p)}','${esc(e.e)}')"><span>${e.i}</span><b>/${esc(n)}</b><small>${esc(e.d)}</small><code>${esc(e.p)}=${esc(e.e)}</code></div>`});vapis.forEach(a=>{cardsHTML+=`<div class="ep" style="--ac:#00c8ff" onclick="ccp('${esc(a.endpoint)}','${esc(a.param)}','${esc(a.example)}')"><span>🔧</span><b>/${esc(a.endpoint)}</b><small>${esc(a.desc||'Custom')}</small><code>${esc(a.param)}=${esc(a.example||'v')}</code></div>`});const opts=Object.entries(endpoints).map(([n,e])=>`<option value="${esc(n)}" data-p="${esc(e.p)}" data-ex="${esc(e.e)}">${e.i} /${esc(n)}</option>`).join('')+vapis.map(a=>`<option value="c_${a.id}" data-c="1" data-ep="${esc(a.endpoint)}" data-p="${esc(a.param)}" data-ex="${esc(a.example)}">🔧 /${esc(a.endpoint)}</option>`).join('');return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>MoonWitch OSINT V100 👑</title><style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#ffffff;color:#333333;font-family:Arial,sans-serif;font-size:16px;line-height:1.5}
.tb{background:#f8f9fa;padding:15px 20px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #dee2e6}
.tb .logo{font-size:20px;font-weight:bold;color:#000}
.tb a{color:#555;text-decoration:none;font-size:16px;margin-left:20px}
.hero{text-align:center;padding:40px 20px}
.hero h1{font-size:32px;margin-bottom:10px}
.ct{max-width:1000px;margin:0 auto;padding:20px}
.st{display:flex;justify-content:center;gap:20px;margin-bottom:30px}
.st>div{text-align:center;padding:20px;background:#f8f9fa;border:1px solid #dee2e6;border-radius:8px;flex:1}
.st .v{font-size:24px;font-weight:bold}
.st .l{font-size:14px;color:#777}
.pl{background:#f8f9fa;border:1px solid #dee2e6;border-radius:8px;padding:20px;margin-bottom:30px}
.pl h3{font-size:20px;margin-bottom:15px}
.plf{display:flex;gap:10px;flex-wrap:wrap}
.plf select,.plf input{flex:1;min-width:200px;padding:12px;border:1px solid #ccc;border-radius:5px;font-size:16px}
.btx{padding:12px 25px;background:#0066cc;color:#fff;border:none;border-radius:5px;cursor:pointer;font-size:16px}
.rb{margin-top:15px;background:#eee;padding:15px;border-radius:5px;font-family:monospace;font-size:14px;display:none;white-space:pre-wrap}
.eg{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:15px}
.ep{background:#fff;border:1px solid #dee2e6;border-radius:8px;padding:15px;cursor:pointer;transition:0.2s}
.ep:hover{border-color:#0066cc}
.ep b{display:block;font-size:18px;margin-bottom:5px}
.ep small{font-size:14px;color:#666;display:block;margin-bottom:8px}
.ep code{font-family:monospace;font-size:13px;background:#f0f0f0;padding:2px 5px}
.ft{text-align:center;padding:30px;border-top:1px solid #dee2e6;font-size:14px;color:#777}
</style></head><body>
<div class="tb"><div class="logo">MoonWitch OSINT V100</div><div><a href="/docs">DOCS</a><a href="/admin">ADMIN</a></div></div>
<header class="hero"><h1>MoonWitch OSINT V100</h1><p>ULTRA PRIME SUITE</p></header>
<div class="ct">
<div class="st">
<div><div class="v">${totalEndpoints}</div><div class="l">ENDPOINTS</div></div>
<div><div class="v">${totalKeys}</div><div class="l">KEYS</div></div>
</div>
<div class="pl"><h3>🧪 API PLAYGROUND</h3><div class="plf"><select id="es"><option value="">Select Endpoint</option>${opts}</select><input id="ak" placeholder="API Key..."><input id="pv" placeholder="Parameter..."><button class="btx" onclick="ta()">⚡ RUN</button></div><div class="rb" id="rb"></div></div>
<div class="eg">${cardsHTML}</div>
</div>
<footer class="ft"><p>MoonWitch OSINT V100 · King Always King</p></footer>
<script>
var eps=${epsJSON};
function toast(m){alert(m)}
function cp(n,p,e){navigator.clipboard.writeText(location.origin+'/api/key-kaddu/'+n+'?key=KEY&'+p+'='+e).then(function(){toast('Copied!')})}
function ccp(n,p,e){navigator.clipboard.writeText(location.origin+'/api/custom/'+n+'?key=KEY&'+p+'='+e).then(function(){toast('Copied!')})}
async function ta(){var s=document.getElementById('es').value,o=document.getElementById('es').options[document.getElementById('es').selectedIndex],k=document.getElementById('ak').value,v=document.getElementById('pv').value,rb=document.getElementById('rb');if(!s||!k||!v){toast('Fill all fields');return}var url=o.dataset.c==='1'?'/api/custom/'+o.dataset.ep+'?key='+k+'&'+o.dataset.p+'='+v:'/api/key-kaddu/'+s+'?key='+k+'&'+eps[s].p+'='+v;rb.style.display='block';rb.textContent='Loading...';try{var r=await fetch(url);var d=await r.json();rb.textContent=JSON.stringify(d,null,2)}catch(e){rb.textContent='Error: '+e.message}}
</script></body></html>`}catch(e){return '<html><body><h1>Error</h1></body></html>'}}

(async function(){const loaded=await loadFromStorage();if(!loaded){initDefaultData();initCustomAPIs()}if(!keyStorage[MASTER_API_KEY])keyStorage[MASTER_API_KEY]=createMasterKey();delete keyStorage['MOONWITCH_MASTER_2026'];scheduleSave();console.log('✅ MoonWitch OSINT V100 ULTRA PRIME Ready! Keys:',Object.keys(keyStorage).length)})();

module.exports = app;
