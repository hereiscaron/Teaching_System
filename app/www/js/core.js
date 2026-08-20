(function(w){
  var TW=w.TW={};
  TW.version='1.0.0';
  TW.$=function(s,r){return (r||document).querySelector(s)};
  TW.$$=function(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s))};
  TW.escape=function(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})};
  TW.uid=function(prefix){return (prefix||'id')+'_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,6)};
  var storageNamespace=document.documentElement.dataset.storageNamespace||'homeroom_workbench';
  var persistentStore=w.LocalWorkbenchStore.create({namespace:storageNamespace,version:2,migrate:function(data){return data}});
  TW.files=w.LocalWorkbenchFiles.create({database:'homeroom_workbench_files_v1'});
  ['subject','entered','fitness','homework','transfer'].forEach(function(key){var legacy='teacherdesk_'+key;if(localStorage.getItem(legacy)!==null&&persistentStore.get(key,null)===null){try{if(persistentStore.set(key,JSON.parse(localStorage.getItem(legacy))).ok)localStorage.removeItem(legacy)}catch(e){}}});
  TW.store={
    read:function(k,fallback){return persistentStore.get(k,fallback)},
    write:function(k,v){return persistentStore.set(k,v).ok},
    update:function(k,fn,fallback){return persistentStore.update(k,fn,fallback)},
    remove:function(k){return persistentStore.remove(k)},
    clear:function(){return persistentStore.clear()},
    exportData:function(){return persistentStore.exportData()},
    importData:function(payload,options){return persistentStore.importData(payload,options)},
    autosave:function(k,delay){return persistentStore.autosave(k,delay)},
    bindForm:function(form,k,options){return persistentStore.bindForm(form,k,options)},
    undo:function(){return persistentStore.undo?persistentStore.undo():{ok:false}},
    redo:function(){return persistentStore.redo?persistentStore.redo():{ok:false}},
    canUndo:function(){return persistentStore.canUndo?persistentStore.canUndo():false},
    canRedo:function(){return persistentStore.canRedo?persistentStore.canRedo():false}
  };
  TW.format={date:function(d){return new Date(d).toLocaleDateString('zh-CN',{year:'numeric',month:'2-digit',day:'2-digit'})},now:function(){return new Date().toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'})},num:function(n){return Number(n||0).toLocaleString('zh-CN',{minimumFractionDigits:0,maximumFractionDigits:1})}};
  TW.toast=function(message,kind){var region=TW.$('.toast-region');if(!region){region=document.createElement('div');region.className='toast-region';document.body.appendChild(region)}var node=document.createElement('div');node.className='toast '+(kind||'');node.textContent=message;region.appendChild(node);setTimeout(function(){node.remove()},2600)};
  TW.modal=function(title,body,actions){var root=TW.$('#modalRoot');root.innerHTML='<div class="modal-backdrop" role="presentation"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="modalTitle"><div class="modal-head"><span id="modalTitle">'+title+'</span><button class="close-button" aria-label="关闭">×</button></div><div class="modal-body">'+body+'</div><div class="modal-foot">'+(actions||'<button class="button secondary" data-close>关闭</button>')+'</div></div></div>';var back=TW.$('.modal-backdrop',root);var close=function(){document.removeEventListener('keydown',onKey);root.innerHTML=''};var onKey=function(e){if(e.key==='Escape'){e.preventDefault();close()}if(e.key==='Tab'){var fs=TW.$$('button,input,select,textarea,[tabindex]:not([tabindex="-1"])',back).filter(function(x){return !x.disabled});if(fs.length&&((e.shiftKey&&document.activeElement===fs[0])||(!e.shiftKey&&document.activeElement===fs[fs.length-1]))){e.preventDefault();fs[e.shiftKey?fs.length-1:0].focus()}}};TW.$('.close-button',back).onclick=close;TW.$$('[data-close]',back).forEach(function(b){b.onclick=close});back.addEventListener('click',function(e){if(e.target===back)close()});document.addEventListener('keydown',onKey);setTimeout(function(){var f=TW.$('button,input,select,textarea',back);if(f)f.focus()},0);return {close:close,root:back}};
  TW.svgIcon=function(name){var p={grid:'班',book:'备',calendar:'表',check:'核',clipboard:'记',chart:'析',ear:'听',users:'研',flag:'班',heart:'健',shield:'安',file:'表',gear:'设',home:'工',list:'作',dorm:'宿',mental:'心',selection:'选',grade:'年',notice:'知',duty:'值',awards:'评',hygiene:'卫',broom:'扫',points:'分',alert:'警'};return p[name]||'模'};
  TW.subjectIcon=function(id,label){var p={reading:'朗',essay:'作',writing:'书',poetry:'诗',mental:'算',mistakes:'错',practice:'练',speaking:'听',shadowing:'跟',words:'词',listening:'听',experiment:'实',equipment:'器',groups:'分',lablog:'记',long_observation:'观',fitness:'体',exempt:'免',breaktime:'课',sunshine:'光',works:'作',rehearsal:'排',artscore:'艺',theme:'题',current:'时',behavior:'评',laborlist:'劳',housework:'家',laborweek:'周',gallery:'展',lab:'机',worksit:'评',project:'项',studytrip:'研'};return p[id]||String(label||'模').slice(0,1)};
  w.addEventListener('workbench:storage',function(event){var status=TW.$('#syncStatus');if(!status)return;var detail=event.detail||{};status.classList.toggle('danger-text',detail.state==='error');status.textContent=detail.state==='saving'?'正在保存到本机…':detail.state==='error'?'本机保存失败，请立即导出备份':detail.state==='external-update'?'检测到其他标签页更新，请刷新查看':'已保存到本机：'+TW.format.now()});
})(window);
