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
  vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5196','--strictPort'],{windowsHide:true,stdio:'pipe',env:{...process.env,API_PROXY_TARGET:''}});
  for(let i=0;i<120;i++){if(vite.exitCode!==null) throw new Error('Inbox test server failed to start');if(await fetch(base+'/admin/').then(r=>r.ok).catch(()=>false))break;await delay(250);}
 }
 browser=await chromium.launch({headless:true});
});
after(async()=>{await browser?.close();vite?.kill();});
const enquiries=Array.from({length:12},(_,i)=>({id:`enquiry-${i+1}`,reference:`BR-${1001+i}`,type:'PACKAGE_ENQUIRY',status:i%2?'CONTACTED':'NEW',requester:{name:`Traveller ${i+1}`,email:`traveller${i+1}@example.com`,phone:'+91 98765 43210'},packageTitle:'Goa escape',assignedTo:i%2?{id:'staff',displayName:'Sales team'}:null,createdAt:'2026-09-20T12:00:00.000Z',updatedAt:'2026-09-20T12:00:00.000Z'}));
async function setup(t,path='enquiries'){
 const context=await browser.newContext({viewport:{width:1366,height:768},reducedMotion:'reduce'});t.after(()=>context.close());
 const items=structuredClone(enquiries);
 const records=Object.fromEntries(items.map(item=>[item.id,{...item,subject:'Travel request',message:'Please share a suitable itinerary.',preferredStartDate:null,adultCount:2,childCount:0,partySize:2,budget:null,currency:'INR',packageSlug:'goa',sourcePath:'/packages/goa',consentAt:item.createdAt,policyVersion:'v1',notes:[],statusHistory:[]}]));
 const staff=[{id:'staff',displayName:'Sales team'},{id:'test',displayName:'Test admin'}];
 const state={reads:[],writes:[],exports:[],errors:[],failRead:false,failDetailRead:false,failWrite:false,records,items};
 await context.route('**/api/v1/**',async route=>{
  const req=route.request(),url=new URL(req.url()),path=url.pathname.replace('/api/v1',''),params=url.searchParams;
  const json=(body,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
  if(path==='/auth/csrf')return json({data:{authenticated:true,csrfToken:'test-csrf',publicSiteUrl:base,user:{id:'test',email:'test@example.com',displayName:'Test admin',role:'SUPER_ADMIN'}}});
  if(path==='/admin/dashboard')return json({data:{newEnquiries:6}});
  if(path==='/admin/assignees')return json({data:staff});
  if(req.method()==='GET')state.reads.push(path+url.search);
  if(req.method()!=='GET'){
   const match=path.match(/^\/admin\/inquiries\/([^/]+)\/(status|notes|assignment)$/);
   assert(match,`Unexpected write: ${path}`);
   const [,id,action]=match,record=records[id],body=req.postDataJSON();
   state.writes.push({path,method:req.method(),body,csrf:req.headers()['x-csrf-token']});
   if(state.failWrite)return json({error:{code:'UNAVAILABLE',message:'Could not save changes. Please try again.'}},503);
   if(action==='status'){
    record.statusHistory.push({id:String(record.statusHistory.length),fromStatus:record.status,toStatus:body.status,reason:body.reason,changedBy:staff[1],createdAt:'2026-09-25T12:00:00.000Z'});
    record.status=body.status;items.find(item=>item.id===id).status=body.status;
   }else if(action==='notes')record.notes.push({id:String(record.notes.length),body:body.body,author:staff[1],createdAt:'2026-09-25T12:00:00.000Z'});
   else {record.assignedTo=staff.find(owner=>owner.id===body.assignedToId)||null;items.find(item=>item.id===id).assignedTo=record.assignedTo;}
   return json({data:record});
  }
  if(path==='/admin/inquiries/export.csv'){state.exports.push(url.searchParams);return route.fulfill({contentType:'text/csv',body:'Reference,Name\nBR-1001,Traveller 1'});}
  if(path==='/admin/inquiries'){
   if(state.failRead)return json({error:{code:'UNAVAILABLE',message:'Could not load the inbox.'}},500);
   const page=Number(params.get('page')||1),pageSize=Number(params.get('pageSize')||25),q=(params.get('q')||'').toLowerCase();
   const matches=items.filter(n=>(!params.get('status')||n.status===params.get('status'))&&(!params.get('type')||n.type===params.get('type'))&&(!q||JSON.stringify(n).toLowerCase().includes(q)));
   return json({data:matches.slice((page-1)*pageSize,page*pageSize),meta:{page,pageSize,total:matches.length}});
  }
  if(path.startsWith('/admin/inquiries/'))return state.failDetailRead ? json({error:{code:'UNAVAILABLE',message:'Could not reload enquiry.'}},503) : json({data:records[path.split('/').at(-1)]});
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
 await page.getByRole('group',{name:'Enquiry status',exact:true}).getByRole('button',{name:'Needs reply',exact:true}).click();
 await page.waitForURL(/status=NEW/);
 const backUrl=page.url();await page.getByRole('link',{name:'View enquiry BR-1001',exact:true}).click();
 await page.getByRole('heading',{name:'Traveller 1',exact:true}).waitFor();
 await page.getByRole('link',{name:'Back to enquiries',exact:true}).click();await page.waitForURL(backUrl);
 assert.equal(await search.inputValue(),'Traveller');
 assert.equal(await page.getByRole('group',{name:'Enquiry status',exact:true}).getByRole('button',{name:'Needs reply',exact:true}).getAttribute('aria-pressed'),'true');
 await page.getByRole('button',{name:'Clear filters',exact:true}).click();
 await page.getByRole('combobox',{name:'Rows per page',exact:true}).click();await page.getByRole('option',{name:'10',exact:true}).click();
 await page.getByRole('button',{name:'Next',exact:true}).click();await page.waitForURL(/page=2/);
 await page.getByRole('link',{name:'View enquiry BR-1011',exact:true}).waitFor();
 await page.reload();await page.getByRole('link',{name:'View enquiry BR-1011',exact:true}).waitFor();
 assert.deepEqual(state.errors,[]);
});

test('date filters validate before requesting and CSV exports preserve the selected filters',async t=>{
 const {page,state}=await setup(t);
 await page.getByText('More filters',{exact:true}).click();
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
 await page.getByRole('heading',{name:'Traveller 1',exact:true}).waitFor();
 assert.equal(await page.getByRole('heading',{name:'Notification delivery',exact:true}).count(),0);
 assert.deepEqual(state.errors,[]);
});

test('follow-up saves use the existing API, preserve failed edits and keep a readable history',async t=>{
 const {page,state}=await setup(t);
 await page.getByRole('link',{name:'View enquiry BR-1001',exact:true}).click();
 await page.getByRole('heading',{name:'Traveller 1',exact:true}).waitFor();
 assert.equal(await page.getByRole('link',{name:'WhatsApp',exact:true}).getAttribute('href'),'https://wa.me/919876543210');
 assert.equal(await page.getByRole('link',{name:'Email',exact:true}).getAttribute('href'),'mailto:traveller1@example.com');
 assert.equal(await page.getByRole('link',{name:'Call',exact:true}).getAttribute('href'),'tel:+91 98765 43210');
 assert.equal(state.writes.length,0);
 state.failWrite=true;
 await page.getByLabel('Follow-up note',{exact:true}).fill('  Shared itinerary; call tomorrow.  ');
 await page.getByRole('button',{name:'Mark as contacted',exact:true}).click();
 await page.getByRole('alert').filter({hasText:'Could not save changes'}).waitFor();
 assert.equal(await page.getByLabel('Follow-up note',{exact:true}).inputValue(),'  Shared itinerary; call tomorrow.  ');
 assert.equal(state.records['enquiry-1'].status,'NEW');
 state.failWrite=false;
 await page.getByRole('button',{name:'Mark as contacted',exact:true}).click();
 await page.getByRole('button',{name:'Mark quote as sent',exact:true}).waitFor();
 assert.equal(await page.getByLabel('Follow-up note',{exact:true}).inputValue(),'');
 assert.deepEqual(state.writes.at(-1),{path:'/admin/inquiries/enquiry-1/status',method:'PATCH',body:{status:'CONTACTED',reason:'Shared itinerary; call tomorrow.'},csrf:'test-csrf'});
 await page.locator('summary').filter({hasText:'Follow-up history'}).click();
 await page.getByText('Needs reply → Contacted',{exact:true}).waitFor();
 await page.getByText('Shared itinerary; call tomorrow.',{exact:true}).waitFor();
 await page.evaluate(()=>window.scrollTo(0,0));
 await page.screenshot({path:join(tmpdir(),'br-enquiry-detail-fixture.png'),fullPage:true});
 for(const width of [1366,1024,390]){
  await page.setViewportSize({width,height:844});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Enquiry detail overflow at ${width}`);
 }
 const contact=await page.getByRole('heading',{name:'Contact the traveller',exact:true}).boundingBox();
 const notes=await page.getByRole('heading',{name:'Private staff notes',exact:true}).boundingBox();
 assert(contact.y<notes.y,'Mobile follow-up controls should appear before staff notes');
 await page.evaluate(()=>window.scrollTo(0,0));
 await page.screenshot({path:join(tmpdir(),'br-enquiry-detail-mobile.png'),fullPage:true});
 await page.getByRole('link',{name:'Back to enquiries',exact:true}).click();
 await page.getByRole('list',{name:'Enquiries',exact:true}).locator('li').first().getByText('Contacted',{exact:true}).waitFor();
 assert.deepEqual(state.errors,[]);
});

test('private notes and owner changes are explicit saves, retain failures, and warn before discarding drafts',async t=>{
 const {page,state}=await setup(t);
 await page.getByRole('link',{name:'View enquiry BR-1001',exact:true}).click();
 const note=page.getByLabel('Add note',{exact:true});await note.fill('  Prefers a morning departure.  ');
 await page.getByRole('link',{name:'Back to enquiries',exact:true}).click();
 const dialog=page.getByRole('alertdialog');await dialog.waitFor();
 await dialog.getByRole('button',{name:'Keep editing',exact:true}).click();
 assert.equal(await note.inputValue(),'  Prefers a morning departure.  ');
 state.failWrite=true;await page.getByRole('button',{name:'Save private note',exact:true}).click();
 await page.getByRole('alert').filter({hasText:'Could not save changes'}).waitFor();
 assert.equal(await note.inputValue(),'  Prefers a morning departure.  ');
 state.failWrite=false;await page.getByRole('button',{name:'Save private note',exact:true}).click();
 await page.getByText('Prefers a morning departure.',{exact:true}).waitFor();
 assert.equal(await note.inputValue(),'');
 assert.deepEqual(state.writes.at(-1).body,{body:'Prefers a morning departure.'});
 assert.equal(state.writes.at(-1).method,'POST');assert.equal(state.writes.at(-1).csrf,'test-csrf');
 const writes=state.writes.length;
 await page.getByRole('combobox',{name:'Enquiry owner',exact:true}).click();await page.getByRole('option',{name:'Sales team',exact:true}).click();
 assert.equal(state.writes.length,writes,'Choosing an owner must not silently save');
 state.failWrite=true;await page.getByRole('button',{name:'Save owner',exact:true}).click();
 await page.getByRole('alert').filter({hasText:'Could not save changes'}).waitFor();
 assert((await page.getByRole('combobox',{name:'Enquiry owner',exact:true}).innerText()).includes('Sales team'));
 state.failWrite=false;await page.getByRole('button',{name:'Save owner',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('button') && [...document.querySelectorAll('button')].some(button=>button.textContent==='Save owner'&&button.disabled));
 assert.equal(state.records['enquiry-1'].assignedTo.id,'staff');
 await page.getByRole('button',{name:'Assign to me',exact:true}).click();
 await page.waitForFunction(()=>![...document.querySelectorAll('button')].some(button=>button.textContent==='Assign to me'));
 assert.deepEqual(state.writes.at(-1).body,{assignedToId:'test'});
 assert.deepEqual(state.errors,[]);
});

test('closing general requests requires confirmation and missing phone details offer email only',async t=>{
 const {page,state}=await setup(t);
 Object.assign(state.records['enquiry-2'],{type:'CONTACT',packageTitle:null,packageSlug:null});state.records['enquiry-2'].requester.phone=null;
 await page.getByRole('link',{name:'View enquiry BR-1002',exact:true}).click();
 await page.getByRole('button',{name:'Close enquiry',exact:true}).waitFor();
 assert.equal(await page.getByRole('link',{name:'Call',exact:true}).count(),0);assert.equal(await page.getByRole('link',{name:'WhatsApp',exact:true}).count(),0);
 await page.getByText('No phone number provided. Please use email.',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Close enquiry',exact:true}).click();
 const dialog=page.getByRole('alertdialog');await dialog.getByRole('heading',{name:'Close this enquiry?',exact:true}).waitFor();
 await dialog.getByRole('button',{name:'Cancel',exact:true}).click();assert.equal(state.writes.length,0);
 await page.getByRole('button',{name:'Close enquiry',exact:true}).click();await dialog.getByRole('button',{name:'Close enquiry',exact:true}).click();
 await page.getByText('No further action is needed. You can still add private notes below.',{exact:true}).waitFor();
 assert.equal(state.records['enquiry-2'].status,'CLOSED');assert.equal(await page.getByRole('combobox',{name:'Outcome',exact:true}).count(),0);
 assert.equal(await page.getByLabel('Add note',{exact:true}).isVisible(),true);
 assert.deepEqual(state.errors,[]);
});

test('not proceeding can reopen and advanced type filters apply only when submitted',async t=>{
 const {page,state}=await setup(t);
 state.records['enquiry-1'].status='LOST';state.items[0].status='LOST';
 await page.getByRole('link',{name:'View enquiry BR-1001',exact:true}).click();
 await page.getByRole('button',{name:'Reopen for follow-up',exact:true}).click();
 await page.getByRole('button',{name:'Mark quote as sent',exact:true}).waitFor();assert.equal(state.records['enquiry-1'].status,'CONTACTED');
 await page.getByRole('link',{name:'Back to enquiries',exact:true}).click();
 await page.getByText('More filters',{exact:true}).click();
 const reads=state.reads.length;
 await page.getByRole('combobox',{name:'Enquiry type',exact:true}).click();await page.getByRole('option',{name:'General enquiry',exact:true}).click();
 assert.equal(state.reads.length,reads);assert.equal(new URL(page.url()).searchParams.has('type'),false);
 await page.getByRole('button',{name:'Apply filters',exact:true}).click();await page.waitForURL(/type=CONTACT/);
 await page.getByText('No matching enquiries',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Remove type filter',exact:true}).click();
 await page.getByRole('list',{name:'Enquiries',exact:true}).waitFor();assert.equal(new URL(page.url()).searchParams.has('type'),false);
 assert.deepEqual(state.errors,[]);
});

test('a failed background refresh keeps the unsaved note and pauses actions until retry succeeds',async t=>{
 const {page,state}=await setup(t);
 await page.getByRole('link',{name:'View enquiry BR-1001',exact:true}).click();
 const draft=page.getByLabel('Add note',{exact:true});await draft.fill('Draft call reminder');
 state.failDetailRead=true;
 await page.getByRole('button',{name:'Mark as contacted',exact:true}).click();
 await page.getByRole('alert').filter({hasText:'Your draft is still here'}).waitFor();
 assert.equal(await draft.inputValue(),'Draft call reminder');
 assert.equal(await page.getByRole('button',{name:'Save private note',exact:true}).isDisabled(),true);
 assert.equal(state.records['enquiry-1'].status,'CONTACTED');
 state.failDetailRead=false;await page.getByRole('button',{name:'Retry details',exact:true}).click();
 await page.getByRole('button',{name:'Mark quote as sent',exact:true}).waitFor();
 assert.equal(await draft.inputValue(),'Draft call reminder');
 await page.getByRole('button',{name:'Save private note',exact:true}).click();
 await page.getByText('Draft call reminder',{exact:true}).waitFor();
 assert.deepEqual(state.errors,[]);
});
