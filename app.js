import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./supabase-config.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
const $ = s => document.querySelector(s);
const pages = {home:"نظرة عامة",tasks:"المهام",employees:"الموظفون",customers:"العملاء",sales:"المبيعات",stock:"المخزون",finance:"المالية",reports:"التقارير",settings:"الإعدادات"};
const cfg = {tasks:["مهمة",["العنوان","الحالة"]],employees:["موظف",["الاسم","الوظيفة"]],customers:["عميل",["الاسم","الهاتف"]],sales:["عملية بيع",["المنتج","القيمة"]],stock:["عنصر مخزون",["العنصر","الكمية"]],finance:["قيد مالي",["الوصف","القيمة"]]};
let user = null, companies = [], activeCompany = null, page = "home";
let localData = JSON.parse(localStorage.coLocalData || "{}");
const localDb = () => localData[activeCompany?.id] ?? (localData[activeCompany?.id] = {employees:[],customers:[],sales:[],stock:[],finance:[]});
const saveLocal = () => localStorage.coLocalData = JSON.stringify(localData);
const esc = s => String(s ?? "—").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function toast(t){$("#toast").textContent=t;$("#toast").style.display="block";setTimeout(()=>$("#toast").style.display="none",2300)}
function authView(message=""){
  $("#auth").hidden=false; $("#appShell").hidden=true;
  $("#authMessage").textContent=message;
}
function appView(){ $("#auth").hidden=true; $("#appShell").hidden=false; }
async function loadCompanies(){
  const {data,error}=await supabase.from("company_members").select("role, companies(id,name,slug,created_at)").order("created_at",{ascending:true});
  if(error) throw error;
  companies=(data||[]).map(x=>({...x.companies,role:x.role})).filter(x=>x.id);
  activeCompany=companies[0]||null;
}
async function startApp(){
  const {data:{user:current},error}=await supabase.auth.getUser();
  if(error) throw error;
  user=current;
  if(!user){authView();return}
  await loadCompanies(); appView(); draw();
}
async function signIn(e){
  e.preventDefault(); const email=$("#email").value.trim(), password=$("#password").value;
  const {error}=await supabase.auth.signInWithPassword({email,password});
  if(error){authView(error.message);return}
  await startApp(); toast("تم تسجيل الدخول");
}
async function signUp(e){
  e.preventDefault(); const email=$("#email").value.trim(), password=$("#password").value;
  if(password.length<8){authView("كلمة المرور يجب أن تكون 8 أحرف على الأقل.");return}
  const {data,error}=await supabase.auth.signUp({email,password});
  if(error){authView(error.message);return}
  if(data.session){await startApp();toast("تم إنشاء الحساب")}
  else authView("تم إنشاء الحساب. افحص بريدك لتأكيد التسجيل ثم سجّل الدخول.");
}
async function createCompany(){
  const name=prompt("اكتب اسم الشركة الجديدة"); if(!name?.trim()) return;
  const {data:company,error}=await supabase.from("companies").insert({name:name.trim(),created_by:user.id}).select("id,name,slug,created_at").single();
  if(error){toast("تعذر إنشاء الشركة: "+error.message);return}
  const {error:memberError}=await supabase.from("company_members").insert({company_id:company.id,user_id:user.id,role:"owner"});
  if(memberError){toast("تم إنشاء الشركة لكن تعذرت إضافة المالك: "+memberError.message);return}
  await loadCompanies(); activeCompany=companies.find(c=>c.id===company.id)||companies[0]; draw(); toast("تم إنشاء مساحة الشركة السحابية");
}
async function getTasks(){
  if(!activeCompany)return [];
  const {data,error}=await supabase.from("tasks").select("id,title,status,priority,due_date,description,created_at").eq("company_id",activeCompany.id).order("created_at",{ascending:false});
  if(error) throw error; return data||[];
}
function shell(content){$("#view").innerHTML=content}
function rows(items){return items.length?items.map(x=>'<div class="row"><span>'+esc(x.title||x.name||x.product||x.item||x.description)+'</span><span class="pill">'+esc(x.status||"مسجل")+'</span></div>').join(""):'<div class="empty">لا توجد سجلات حتى الآن</div>'}
function localTable(items){if(!items.length)return '<div class="empty">لا توجد بيانات. أضف أول سجل للبدء.</div>';const keys=Object.keys(items[0]);return '<div class="tablebox"><table><thead><tr>'+keys.map(k=>'<th>'+esc(k)+'</th>').join("")+'</tr></thead><tbody>'+items.map(x=>'<tr>'+keys.map(k=>'<td>'+esc(x[k])+'</td>').join("")+'</tr>').join("")+'</tbody></table></div>'}
async function draw(){
  if(!activeCompany){$("#company").innerHTML="";$("#crumb").textContent="لا توجد شركة";$("#heading").textContent="نظرة عامة";shell('<div class="panel"><h3>ابدأ مساحة عملك</h3><p>أنشئ أول شركة لتبدأ إدارة بياناتها.</p><button class="primary" id="emptyCreate">＋ إنشاء شركة</button></div>');$("#emptyCreate").onclick=createCompany;return}
  $("#company").innerHTML=companies.map(c=>'<option value="'+c.id+'" '+(c.id===activeCompany.id?"selected":"")+'>'+esc(c.name)+'</option>').join("");
  $("#heading").textContent=pages[page];$("#crumb").textContent=activeCompany.name;
  document.querySelectorAll("nav button").forEach(b=>b.classList.toggle("active",b.dataset.page===page));
  const d=localDb();
  if(page==="home"){
    let tasks=[];try{tasks=await getTasks()}catch(e){toast("تعذر تحميل المهام: "+e.message)}
    shell('<div class="welcome"><div><h2>مرحباً بك في '+esc(activeCompany.name)+'</h2><div class="muted">مساحة عمل سحابية • '+esc(user.email)+'</div></div><button class="primary" data-add="tasks">＋ مهمة جديدة</button></div><div class="stats">'+[['الموظفون',d.employees.length],['العملاء',d.customers.length],['المهام',tasks.length],['المبيعات',d.sales.length]].map(x=>'<div class="card"><small>'+x[0]+'</small><strong>'+x[1]+'</strong><span class="pill">إجمالي السجلات</span></div>').join("")+'</div><div class="panel"><h3>آخر المهام السحابية</h3>'+rows(tasks.slice(0,5))+'</div><p class="muted">المهام والشركات محفوظة في Supabase. أقسام الموظفين والعملاء والمبيعات والمخزون والمالية ما زالت محلية على هذا الجهاز في هذه النسخة.</p>');
    return;
  }
  if(page==="tasks"){
    try{const tasks=await getTasks();shell('<div class="toolbar"><span class="muted">مهام هذه الشركة محفوظة سحابياً</span><button class="primary" data-add="tasks">＋ إضافة مهمة</button></div>'+ (tasks.length?'<div class="tablebox"><table><thead><tr><th>العنوان</th><th>الحالة</th><th>الأولوية</th><th>تاريخ الإنشاء</th></tr></thead><tbody>'+tasks.map(t=>'<tr><td>'+esc(t.title)+'</td><td>'+esc(t.status)+'</td><td>'+esc(t.priority)+'</td><td>'+new Date(t.created_at).toLocaleDateString("ar-EG")+'</td></tr>').join("")+'</tbody></table></div>':'<div class="empty">لا توجد مهام بعد</div>'))}catch(e){shell('<div class="empty">تعذر تحميل المهام: '+esc(e.message)+'</div>')}return;
  }
  if(cfg[page]){shell('<div class="toolbar"><span class="muted">بيانات محلية مؤقتاً على هذا الجهاز</span><button class="primary" data-add="'+page+'">＋ إضافة '+cfg[page][0]+'</button></div>'+localTable(d[page]));return}
  if(page==="reports"){shell('<div class="stats">'+[['الموظفون',d.employees.length],['العملاء',d.customers.length],['المبيعات',d.sales.length]].map(x=>'<div class="card"><small>'+x[0]+'</small><strong>'+x[1]+'</strong></div>').join("")+'</div>');return}
  shell('<div class="panel"><h3>إعدادات الحساب</h3><p class="muted">الإصدار 1.1.0 • متصل بـ Supabase</p><p>'+esc(user.email)+'</p><button id="export" class="secondary">تصدير البيانات المحلية JSON</button> <button id="logout" class="secondary">تسجيل الخروج</button><p class="muted">لا تشارك مفاتيح الخدمة السرية. مفتاح النشر الموجود في التطبيق مخصص للعميل ويخضع لسياسات RLS.</p></div>');
  $("#export").onclick=()=>{const a=document.createElement("a"),u=URL.createObjectURL(new Blob([JSON.stringify(localData,null,2)],{type:"application/json"}));a.href=u;a.download="company-local-backup.json";a.click();URL.revokeObjectURL(u)};
  $("#logout").onclick=async()=>{await supabase.auth.signOut();user=null;authView("تم تسجيل الخروج")};
}
document.addEventListener("click",async e=>{
  const p=e.target.closest("[data-page]"),a=e.target.closest("[data-add]");
  if(p){page=p.dataset.page;await draw()}
  if(a)open(a.dataset.add);
});
$("#company").onchange=e=>{activeCompany=companies.find(c=>c.id===e.target.value)||null;draw()};
$("#newCompany").onclick=createCompany;
$("#menu").onclick=()=>$("#side").classList.toggle("open");
function open(k){
  const fields=cfg[k][1];$("#dlgTitle").textContent="إضافة "+cfg[k][0];
  $("#fields").innerHTML=(k==="tasks"?'<label>العنوان</label><input class="field" name="title" required><label>الوصف</label><textarea class="field" name="description"></textarea><label>الأولوية</label><select class="field" name="priority"><option value="normal">عادية</option><option value="low">منخفضة</option><option value="high">عالية</option><option value="urgent">عاجلة</option></select><label>تاريخ الاستحقاق</label><input class="field" type="date" name="due_date">':'<label>'+fields[0]+'</label><input class="field" name="'+fields[0]+'" required><label>'+fields[1]+'</label><input class="field" name="'+fields[1]+'" required>');
  $("#dlg").dataset.kind=k;$("#dlg").showModal();
}
$("#form").onsubmit=async e=>{
  if(e.submitter.value!=="default")return;e.preventDefault();
  const k=$("#dlg").dataset.kind, raw=Object.fromEntries(new FormData(e.currentTarget));
  try{
    if(k==="tasks"){
      const {error}=await supabase.from("tasks").insert({company_id:activeCompany.id,title:raw.title,description:raw.description||null,priority:raw.priority||"normal",due_date:raw.due_date||null,created_by:user.id});
      if(error)throw error;
    }else{const fields=cfg[k][1],obj={[fields[0]]:raw[fields[0]],[fields[1]]:raw[fields[1]]};localDb()[k].push(obj);saveLocal()}
    $("#dlg").close();await draw();toast("تم حفظ السجل");
  }catch(err){toast("تعذر الحفظ: "+err.message)}
};
$("#signInForm").onsubmit=signIn;
$("#signUpBtn").onclick=()=>$("#signUpForm").requestSubmit();
$("#signUpForm").onsubmit=signUp;
supabase.auth.onAuthStateChange((_event,session)=>{if(!session){user=null;authView()}});
try{await startApp()}catch(e){authView("تعذر الاتصال: "+e.message)}
if("serviceWorker"in navigator)addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));
