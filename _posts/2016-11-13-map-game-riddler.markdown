---
layout: post
title:  "538 Riddler: Allison, Bob, and the Technicolor Dream Map"
date:   2016-11-13
categories: 538, fivethirtyeight, riddler
tags: 538, fivethirtyeight, riddler
permalink: /map-game-riddler
---

<svg id="map-game-riddler" style="display:block; margin-left:auto; margin-right:auto;" width="580" height="400" xmlns="http://www.w3.org/2000/svg">
 <g>
   <ellipse stroke="#000000" ry="172" rx="239" cy="202" cx="285" fill="#ffffaa"/>
   <ellipse stroke="#000000" ry="93" rx="121" cy="171" cx="354" fill="#ffaaff"/>
   <ellipse stroke="#000000" ry="73" rx="86" cy="181" cx="187" fill="#ffd4aa"/>
   <ellipse stroke="#000000" ry="39" rx="51" cy="191" cx="366" fill="#56aaff"/>
   <ellipse stroke="#000000" ry="39" rx="51" cy="191" cx="210" fill="#ffaaaa"/>
   <ellipse stroke="#000000" ry="39" rx="51" cy="282" cx="285" fill="#56ffaa"/>
   <ellipse stroke="#000000" ry="39" rx="51" cy="191" cx="285" fill="#56ffaa"/>
   <ellipse stroke="#000000" ry="39" rx="124" cy="240" cx="374" fill="#ffaaaa"/>
   <ellipse stroke="#000000" ry="39" rx="124" cy="240" cx="197" fill="#56aaff"/>
 </g>
</svg>

<a class="animate">Animate</a>

<script type="text/javascript">
  $(document).ready(function(){  

    svg = $("svg#map-game-riddler")
    elements = svg.find("ellipse");

    function loop(el){
      el.show(0);
      next_el = el.prev();
      if (next_el.length > 0){
        setTimeout(function(){ loop(next_el); }, 750);         
      }
    }

    svg.next().find("a.animate").click(function(){
      elements.hide(0);
      loop(elements.last());      
    });

  });
</script>
