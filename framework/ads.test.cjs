const {test}=require('node:test'),assert=require('node:assert/strict');
const ads=require('./ads.js');
const t=Date.parse('2026-11-04T10:00:00+08:00');
const c={mode:'scheduled',hosts:['example.com'],enableAt:'2026-11-04T10:00:00+08:00',units:{rail:{key:'a'.repeat(32),scriptUrl:'https://ads.example/invoke.js'}}};
test('absolute boundary, timezone, and reload retain the same deadline',()=>{
 assert.equal(ads.eligible(c,'example.com',t-1),false);
 assert.equal(ads.eligible(c,'example.com',t),true);
 assert.equal(ads.eligible(JSON.parse(JSON.stringify(c)),'example.com',t+86400000),true);
 assert.equal(ads.timestamp('2026-11-04T02:00:00Z'),t);
});
test('disabled, missing, malformed and wrong-host configurations fail closed',()=>{
 for(const v of [undefined,{...c,mode:'off'},{...c,enableAt:'tomorrow'},{...c,enableAt:'2026-11-04T10:00:00'},{...c,units:{}},{...c,units:{rail:{key:'bad',scriptUrl:'javascript:alert(1)'}}}])assert.equal(ads.eligible(v,'example.com',t),false);
 assert.equal(ads.eligible(c,'preview.example.com',t),false);
 assert.equal(ads.eligible(c,'example.com',NaN),false);
});
test('rail requires width and height; missing formats never fall through to another site code',()=>{
 assert.equal(ads.choose(c,'articleLeft',160,700,1280),'rail');
 assert.equal(ads.choose(c,'articleLeft',160,699,1280),null);
 assert.equal(ads.choose(c,'articleLeft',160,900,1279),null);
 assert.equal(ads.choose(c,'homeBanner',800,900,1440),null);
});
