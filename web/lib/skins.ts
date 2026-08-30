/**
 * The generative skin engine.
 *
 * PRAHARI reskins itself on every load: a skin is picked at random before first
 * paint, so the workbench feels freshly generated each visit while every data
 * feature stays identical. A skin is nothing but a palette + type + shape token
 * set, defined in globals.css under `html[data-skin="…"]`; this registry names
 * them for the reshuffle control and drives the pre-paint picker.
 *
 * Every skin is hand-tuned, so a random draw is always a good draw.
 */

export interface Skin {
  id: string;
  name: string;
  accent: string;   // representative colour, for the swatch in the control
  mood: string;
}

export const SKINS: Skin[] = [
  { id: "ember",   name: "Ember",   accent: "#E8503A", mood: "near-black · ember" },
  { id: "abyss",   name: "Abyss",   accent: "#38BDF8", mood: "deep navy · cyan" },
  { id: "verdant", name: "Verdant", accent: "#34D399", mood: "black-green · emerald" },
  { id: "plasma",  name: "Plasma",  accent: "#C084FC", mood: "violet-black · magenta" },
  { id: "solar",   name: "Solar",   accent: "#FB923C", mood: "warm black · gold" },
  { id: "arctic",  name: "Arctic",  accent: "#22D3EE", mood: "blue-graphite · ice" },
];

export const LAYOUTS = ["a", "b"] as const; // side-rail left / right

// The pre-paint script string, injected into <head>. It must be dependency-free
// and synchronous so it applies before the first paint (no flash, no layout
// shift). A ?skin= query param or a "locked" choice overrides the random draw.
export const SKIN_PICKER_SCRIPT = `
(function(){
  try{
    var ids=${JSON.stringify(SKINS.map((s) => s.id))};
    var layouts=${JSON.stringify(LAYOUTS)};
    var url=new URL(window.location.href);
    var forced=url.searchParams.get('skin');
    var locked=localStorage.getItem('prahari-skin-lock');
    var skin=(forced&&ids.indexOf(forced)>=0)?forced:(locked&&ids.indexOf(locked)>=0)?locked:ids[Math.floor(Math.random()*ids.length)];
    var layout=layouts[Math.floor(Math.random()*layouts.length)];
    var d=document.documentElement;
    d.setAttribute('data-skin',skin);
    d.setAttribute('data-layout',layout);
    d.setAttribute('data-fresh', (forced||locked)?'0':'1');
  }catch(e){ document.documentElement.setAttribute('data-skin','ember'); }
})();
`;
