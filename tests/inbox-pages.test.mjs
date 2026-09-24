import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { before, after, test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';
const base = process.env.INBOX_TEST_BASE_URL || 'http://127.0.0.1:5196';
let vite, browser;
before(async () => {
 if (!process.env.INBOX_TEST_BASE_URL) {
  vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5196','--strictPort'],{windowsHide:true,stdio:'pipe',env:{...process.env,VITE_API_BASE_URL:'/api/v1',VITE_PUBLIC_SITE_URL:base,VITE_API_PROXY_TARGET:''}});
  for(let i=0;i<120;i++){if(vite.exitCode!==null) throw new Error('Inbox test server failed to start');if(await fetch(base+'/admin/').then(r=>r.ok).catch(()=>false))break;await delay(250);}
 }
 browser=await chromium.launch({headless:true});
});
after(async()=>{await browser?.close();vite?.kill();});
const enquiries=Array.from({length:12},(_,i)=>({id:`enquiry-${i+1}`,reference:`BR-${1001+i}`,type:'PACKAGE_ENQUIRY',status:i%2?'CONTACTED':'NEW',requester:{name:`Traveller ${i+1}`,email:`traveller${i+1}@example.com`,phone:'+91 98765 43210'},packageTitle:'Goa escape',assignedTo:i%2?{id:'staff',displayName:'Sales team'}:null,createdAt:'2026-09-20T12:00:00.000Z',updatedAt:'2026-09-20T12:00:00.000Z'}));
async function setup(t,path='enquiries'){
 const context=await browser.newContext({viewport:{width:1366,height:768},reducedMotion:'reduce'});t.after(()=>context.close());
 const state={reads:[],writes:[],exports:[],errors:[],failRead:false};
 await context.route('**/api/v1/**',async route=>{
  const req=route.request(),url=new URL(req.url()),path=url.pathname.replace('/api/v1',''),params=url.searchParams;
  const json=(body,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
  if(path==='/auth/csrf')return json({data:{authenticated:true,csrfToken:'test-csrf',user:{id:'test',email:'test@example.com',displayName:'Test admin',role:'SUPER_ADMIN'}}});
  if(path==='/admin/dashboard')return json({data:{newEnquiries:6}});
  if(req.method()==='GET')state.reads.push(path+url.search);
  if(path==='/admin/inquiries/export.csv'){state.exports.push(url.searchParams);return route.fulfill({contentType:'text/csv',body:'Reference,Name\nBR-1001,Traveller 1'});}
  if(path==='/admin/inquiries'){
   if(state.failRead)return json({error:{code:'UNAVAILABLE',message:'Could not load the inbox.'}},500);
   const page=Number(params.get('page')||1),pageSize=Number(params.get('pageSize')||25),q=(params.get('q')||'').toLowerCase();
   let items=structuredClone(enquiries).filter(n=>(!params.get('status')||n.status===params.get('status'))&&(!q||JSON.stringify(n).toLowerCase().includes(q)));
   return json({data:items.slice((page-1)*pageSize,page*pageSize),meta:{page,pageSize,total:items.length}});
  }
  if(path.startsWith('/admin/inquiries/')){const item=enquiries.find(n=>path.endsWith('/'+n.id));return json({data:{...item,subject:'Travel request',message:'Please share a suitable itinerary.',preferredStartDate:null,adultCount:2,childCount:0,partySize:2,budget:null,currency:'INR',packageSlug:'goa',departureId:null,sourcePath:'/packages/goa',consentAt:item.createdAt,policyVersion:'v1',notes:[],statusHistory:[],delivery:[]}});}
  assert.equal(req.method(),'GET',`Unexpected write: ${path}`);return json({data:[]});
 });
 const page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>state.errors.push(e.message));
 await page.goto(base+'/admin/'+path,{waitUntil:'domcontentloaded',timeout:60000});
 await page.getByRole('list',{name:'Enquiries',exact:true}).waitFor();
 return {page,state};
}

test('enquiries search on submit, retain filters when viewing details and paginate in the URL',async t=>{
 const {page,state}=await setup(t);
 const search=page.getByRole('searchbox',{name:'Search enquiries',exact:true});
 const count=state.reads.length;await search.fill('Traveller');await delay(350);assert.equal(state.reads.length,count);
 await search.press('Enter');await page.waitForURL(/q=Traveller/);
 await page.getByRole('group',{name:'Enquiry status',exact:true}).getByRole('button',{name:'New',exact:true}).click();
 await page.waitForURL(/status=NEW/);
 const backUrl=page.url();await page.getByRole('link',{name:'View enquiry BR-1001',exact:true}).click();
 await page.getByRole('heading',{name:'BR-1001',exact:true}).waitFor();
 await page.getByRole('link',{name:'Back to enquiries',exact:true}).click();await page.waitForURL(backUrl);
 assert.equal(await search.inputValue(),'Traveller');
 assert.equal(await page.getByRole('group',{name:'Enquiry status',exact:true}).getByRole('button',{name:'New',exact:true}).getAttribute('aria-pressed'),'true');
 await page.getByRole('button',{name:'Clear filters',exact:true}).click();
 await page.getByRole('combobox',{name:'Rows per page',exact:true}).click();await page.getByRole('option',{name:'10',exact:true}).click();
 await page.getByRole('button',{name:'Next',exact:true}).click();await page.waitForURL(/page=2/);
 await page.getByRole('link',{name:'View enquiry BR-1011',exact:true}).waitFor();
 await page.reload();await page.getByRole('link',{name:'View enquiry BR-1011',exact:true}).waitFor();
 assert.deepEqual(state.errors,[]);
});

test('date filters validate before requesting and CSV exports preserve the selected filters',async t=>{
 const {page,state}=await setup(t);
 await page.getByText('Package & date filters',{exact:true}).click();
 await page.getByLabel('Received from (IST)',{exact:true}).fill('2026-09-22');await page.getByLabel('Received until (IST)',{exact:true}).fill('2026-09-01');
 const reads=state.reads.length;await page.getByRole('button',{name:'Apply filters',exact:true}).click();
 await page.getByRole('alert').filter({hasText:'Choose an end date'}).waitFor();assert.equal(state.reads.length,reads);
 await page.getByLabel('Received from (IST)',{exact:true}).fill('2026-09-01');await page.getByLabel('Received until (IST)',{exact:true}).fill('2026-09-22');await page.getByLabel('Package',{exact:true}).fill('Goa');
 await page.getByRole('button',{name:'Apply filters',exact:true}).click();await page.waitForURL(/package=Goa/);
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'Export CSV',exact:true}).click();await download;
 assert.equal(state.exports.at(-1).get('package'),'Goa');assert.equal(state.exports.at(-1).get('from'),'2026-09-01');assert.equal(state.exports.at(-1).get('to'),'2026-09-22');
 const first=page.getByRole('list',{name:'Enquiries',exact:true}).locator('li').first();
 assert.equal(await first.locator('a[href^="mailto:"]').getAttribute('href'),'mailto:traveller1@example.com');assert.equal(await first.locator('a[href^="tel:"]').getAttribute('href'),'tel:+91 98765 43210');
 for(const width of [1366,1024,390]){await page.setViewportSize({width,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Enquiries overflow at ${width}`);}
 assert((await page.getByRole('searchbox',{name:'Search enquiries',exact:true}).boundingBox()).width>=200);
 await page.screenshot({path:join(tmpdir(),'br-enquiries-mobile.png')});
 await page.setViewportSize({width:1366,height:768});await page.screenshot({path:join(tmpdir(),'br-enquiries-fixture.png'),fullPage:true});
 assert.deepEqual(state.errors,[]);
});

test('notifications are removed and old bookmarks return to enquiries',async t=>{
 const {page,state}=await setup(t,'notifications');
 await page.waitForURL(/\/admin\/enquiries$/);
 assert.equal(await page.getByRole('link',{name:'Notifications',exact:true}).count(),0);
 assert(state.reads.every(path=>!path.includes('/notifications')));
 await page.getByRole('link',{name:'View enquiry BR-1001',exact:true}).click();
 await page.getByRole('heading',{name:'BR-1001',exact:true}).waitFor();
 assert.equal(await page.getByRole('heading',{name:'Notification delivery',exact:true}).count(),0);
 assert.deepEqual(state.errors,[]);
});
