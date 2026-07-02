// api/index.js - MoonWitch OSINT V100 ULTRA PRIME - ALL IN ONE
const express = require('express');
const axios = require('axios');
const app = express();

const REAL_API_BASE = 'https://ft-osint-api.duckdns.org/api';
const REAL_API_KEY = process.env.REAL_API_KEY || 'bot-new';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'MoonWitch_ULTRA';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'king5';
const MASTER_API_KEY = process.env.MASTER_API_KEY || 'MOONWITCH_MASTER_' + Math.random().toString(36).substring(2, 10).toUpperCase();

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
            files: { 'moonwitch_data.json': { content: JSON.stringify(fullData, null, 2) } }
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
        
        if (res.data && res.data.files && res.data.files['moonwitch_data.json']) {
            const d = JSON.parse(res.data.files['moonwitch_data.json'].content);
            
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

// ... [The rest of your logic functions should be updated by replacing "BRONX" with "MoonWitch" in your local editor] ...
