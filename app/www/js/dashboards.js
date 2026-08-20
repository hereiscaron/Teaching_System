/* 图表工具（真实数据驱动）：折线图 / 柱状图 / 饼图
 * 替代原先的随机种子装饰图与"健康指数"仪表盘。
 * 字体遵循全站下限 19px（与首页"已保存"一致）。
 * 用法：
 *   TW.drawLine(canvas, {labels:[], series:[{name,color,values:[]}], yMin, yMax})
 *   TW.drawBar(canvas, {labels:[], values:[], color, unit})
 *   TW.drawBar(canvas, {labels:[], stacked:[{name,color,values:[]}], unit})  // 堆叠柱，顶部学科图例
 *   TW.drawPie(canvas, {items:[{label,value,color}]})   // 占比≥15% 扇区内部标百分比
 *   TW.pieLegend(items)                                  // 生成 HTML 图例（19px）
 */
(function(w){
  var TW=w.TW;
  var FONT='19px "KaiTi","楷体",serif';
  /* 图表配色随界面主题（配色1/配色2/深夜模式）动态读取 CSS 变量，
   * 避免深夜模式下文字/网格仍是深色不可见。 */
  function themeColors(){
    var cs=getComputedStyle(document.documentElement);
    var ink=cs.getPropertyValue('--ink').trim()||'rgba(23,34,27,.85)';
    var surface=cs.getPropertyValue('--surface').trim()||'#fbfaf6';
    return {
      ink: ink,
      muted: 'color-mix(in srgb, ' + ink + ' 55%, transparent)',
      soft: 'color-mix(in srgb, ' + ink + ' 10%, transparent)',
      chipBg: 'color-mix(in srgb, ' + surface + ' 96%, transparent)'
    };
  }

  function setup(canvas){
    var rect=canvas.getBoundingClientRect();
    if(rect.width<10)rect={width:Math.max(320,canvas.parentNode.clientWidth||320),height:280};
    var dpr=Math.min(2,w.devicePixelRatio||1);
    canvas.width=Math.max(300,Math.floor(rect.width))*dpr;
    canvas.height=Math.max(240,Math.floor(rect.height))*dpr;
    var c=canvas.getContext('2d');c.scale(dpr,dpr);c.clearRect(0,0,canvas.width,canvas.height);
    var t=themeColors();
    return {c:c,w:canvas.width/dpr,h:canvas.height/dpr,ink:t.ink,muted:t.muted,soft:t.soft,chip:t.chipBg};
  }

  TW.drawLine=function(canvas,opt){
    var s=setup(canvas),c=s.c,W=s.w,H=s.h;
    var INK=s.ink,SOFT=s.soft;
    var left=60,top=30,right=W-18,bottom=H-46;
    var labels=opt.labels||[],series=opt.series||[];
    var all=[];series.forEach(function(se){se.values.forEach(function(v){all.push(Number(v)||0)})});
    var yMin=opt.yMin!=null?Number(opt.yMin):Math.max(0,Math.floor((Math.min.apply(null,all)-6)/10)*10);
    var yMax=opt.yMax!=null?Number(opt.yMax):Math.ceil((Math.max.apply(null,all)+6)/10)*10;
    if(yMax<=yMin)yMax=yMin+10;
    function y(v){return bottom-(Number(v)-yMin)/(yMax-yMin)*(bottom-top)}
    function x(i){return labels.length<=1?left:left+i*(right-left)/(labels.length-1)}
    // 网格与 Y 轴刻度
    c.strokeStyle=SOFT;c.lineWidth=1;c.fillStyle=INK;c.font=FONT;c.textAlign='right';
    for(var g=0;g<=4;g++){var gy=top+g*(bottom-top)/4;c.beginPath();c.moveTo(left,gy);c.lineTo(right,gy);c.stroke();var gv=Math.round(yMax-(yMax-yMin)*g/4);c.fillText(String(gv),left-10,gy+7)}
    // X 轴标签
    c.textAlign='center';
    labels.forEach(function(lb,i){c.fillText(String(lb),x(i),bottom+26)});
    // 折线
    c.lineCap='round';c.lineJoin='round';
    series.forEach(function(se){
      c.beginPath();
      se.values.forEach(function(v,i){var px=x(i),py=y(v);if(i===0)c.moveTo(px,py);else c.lineTo(px,py)});
      c.strokeStyle=se.color||'#2e6bc4';c.lineWidth=2.5;c.stroke();
      se.values.forEach(function(v,i){c.beginPath();c.arc(x(i),y(v),4,0,Math.PI*2);c.fillStyle=se.color||'#2e6bc4';c.fill()});
    });
    // 图例
    c.textAlign='left';var lx=left,ly=top-10;
    series.forEach(function(se){c.fillStyle=se.color||'#2e6bc4';c.fillRect(lx,ly-11,20,4);c.fillStyle=INK;c.fillText(se.name||'',lx+26,ly-2);lx+=26+c.measureText(se.name||'').width+28});
  };

  TW.drawBar=function(canvas,opt){
    var s=setup(canvas),c=s.c,W=s.w,H=s.h;
    var INK=s.ink,SOFT=s.soft;
    var left=56,top=28,right=W-14,bottom=H-46;
    var labels=opt.labels||[];
    var stacked=opt.stacked||null;
    var values;
    if (stacked) {
      values=labels.map(function(_,i){return stacked.reduce(function(sum,se){return sum+(Number(se.values[i])||0)},0)});
    } else {
      values=(opt.values||[]).map(function(v){return Number(v)||0});
    }
    var yMax=Math.max(1,Math.ceil((Math.max.apply(null,[0].concat(values))+4)/10)*10);
    function y(v){return bottom-(v/yMax)*(bottom-top)}
    var bw=(right-left)/Math.max(1,labels.length)*0.62;
    c.strokeStyle=SOFT;c.fillStyle=INK;c.font=FONT;c.textAlign='right';
    for(var g=0;g<=4;g++){var gy=top+g*(bottom-top)/4;c.beginPath();c.moveTo(left,gy);c.lineTo(right,gy);c.stroke();c.fillText(String(Math.round(yMax-yMax*g/4)),left-10,gy+7)}
    c.textAlign='center';
    labels.forEach(function(lb,i){
      var px=left+(right-left)*(i+0.5)/labels.length;
      if (stacked) {
        // 堆叠柱：按累加值逐学科堆叠，柱顶=当日合计
        var acc = 0;
        stacked.forEach(function(se){
          var v = Number(se.values[i]) || 0;
          if (v <= 0) return;
          acc += v;
          var yTop = y(acc), yBot = y(acc - v);
          c.fillStyle = se.color; c.beginPath();
          if (c.roundRect) { c.roundRect(px - bw / 2, yTop, bw, yBot - yTop, [3, 3, 0, 0]); c.fill(); } else { c.fillRect(px - bw / 2, yTop, bw, yBot - yTop); }
        });
        if (values[i] > 0) { c.fillStyle = INK; c.fillText(String(values[i]), px, y(values[i]) - 9); }
      } else {
        var v2=values[i],bh2=bottom-y(v2);
        c.fillStyle=opt.color||'#789783';c.beginPath();
        if(c.roundRect){c.roundRect(px-bw/2,y(v2),bw,bh2,[4,4,0,0]);c.fill()}else{c.fillRect(px-bw/2,y(v2),bw,bh2)}
        c.fillStyle=INK;c.fillText(opt.unit?values[i]+opt.unit:String(values[i]),px,y(values[i])-9);
      }
      c.fillStyle=INK;c.fillText(String(lb),px,bottom+26);
    });
    if (stacked) {
      // 学科图例（顶部，与 drawLine 一致）
      c.textAlign='left';var lx=left,ly=top-10;
      stacked.forEach(function(se){c.fillStyle=se.color;c.fillRect(lx,ly-11,20,4);c.fillStyle=INK;c.fillText(se.name||'',lx+26,ly-2);lx+=26+c.measureText(se.name||'').width+28});
    }
  };

  TW.drawPie=function(canvas,opt){
    var s=setup(canvas),c=s.c,W=s.w,H=s.h;
    var items=(opt.items||[]).filter(function(it){return Number(it.value)>0});
    var total=items.reduce(function(sum,it){return sum+Number(it.value)},0)||1;
    var cx=W/2,cy=H/2,R=Math.min(W,H)/2-20,angle=-Math.PI/2;
    var palette=['#789783','#2e6bc4','#a98250','#ad6962','#5a8f72','#8bb6a0','#d9b4f2','#c9a227'];
    items.forEach(function(it,i){
      var a=Number(it.value)/total*Math.PI*2;
      c.beginPath();c.moveTo(cx,cy);c.arc(cx,cy,R,angle,angle+a);c.closePath();
      c.fillStyle=it.color||palette[i%palette.length];c.fill();
      var pct=Math.round(Number(it.value)/total*100);
      // 占比≥15% 的扇区在内部标注百分比（19px），其余在图例中展示
      if(a>=0.094){var mid=angle+a/2;c.fillStyle=s.chip;c.font='bold 19px "KaiTi","楷体",serif';c.textAlign='center';c.fillText(pct+'%',cx+Math.cos(mid)*R*0.62,cy+Math.sin(mid)*R*0.62+7)}
      angle+=a;
    });
  };

  TW.pieLegend=function(items){
    var palette=['#789783','#2e6bc4','#a98250','#ad6962','#5a8f72','#8bb6a0','#d9b4f2','#c9a227'];
    var total=items.reduce(function(sum,it){return sum+Number(it.value||0)},0)||1;
    return '<div class="chart-legend">'+(items||[]).map(function(it,i){return '<span><i style="background:'+(it.color||palette[i%palette.length])+'"></i>'+(it.label||'')+' '+(it.value||0)+'人（'+Math.round(Number(it.value||0)/total*100)+'%）</span>';}).join('')+'</div>';
  };
})(window);
