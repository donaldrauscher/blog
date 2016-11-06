function katex_render(node, params){
  dom = $(node).get(0);
  eqn = $(node).attr("data-expr");
  katex.render(eqn, dom, params);
}

$(document).ready(function(){
  $(".inline-equation").each(function(){ katex_render(this, {}) });
  $(".equation").each(function(){ katex_render(this, { displayMode: true }) });
});
