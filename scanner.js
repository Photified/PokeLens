import {prepareVision,searchImages} from './visual.js';
import {cardViews,textRegion} from './imaging.js';
import {visualMap} from './recognition.js';
let workerPromise;
export function prepareOCR(progress=()=>{}){
 if(!workerPromise)workerPromise=(async()=>{
  if(!window.Tesseract)throw new Error('Text scanner could not load. Reload the app.');
  progress('Preparing text scanner…');
  return Tesseract.createWorker('eng',1,{
   workerPath:new URL('./vendor/worker.min.js',import.meta.url).href,
   corePath:new URL('./vendor/',import.meta.url).href,
   langPath:new URL('./vendor/best/',import.meta.url).href,
   cachePath:'pokelens-ocr-v2'
  });
 })().catch(e=>{workerPromise=null;throw e;});return workerPromise;
}
export async function scanFrame(source,progress=()=>{},engines={}){
 const [w]=await Promise.all([engines.ocr?Promise.resolve(engines.ocr):prepareOCR(progress),engines.search?Promise.resolve():prepareVision(progress)]);
 progress('Finding the card and comparing images…');
 const views=await cardViews(source),visual=await (engines.search||searchImages)(views);
 if((visual.matches[0]?.similarity||0)<.42)return {title:'',text:'',bottom:'',visual:visualMap(visual),features:visual.features,view:0,viewCount:views.length};
 const chosen=views[visual.matches[0]?.view??0]||source;
 engines.onViews?.(views,visual.matches[0]?.view??0);
 progress('Checking title, moves and card number…');
 await w.setParameters({tessedit_pageseg_mode:'7',thresholding_method:'2',preserve_interword_spaces:'1'});
 let title=(await w.recognize(textRegion(chosen,'title','color'))).data.text;
 await w.setParameters({thresholding_method:'0'});
 title+='\n'+(await w.recognize(textRegion(chosen,'title','color'))).data.text;
 await w.setParameters({tessedit_pageseg_mode:'11',thresholding_method:'2'});
 const text=(await w.recognize(textRegion(chosen,'full','color'))).data.text;
 const bottom=(await w.recognize(textRegion(chosen,'bottom','gray'))).data.text;
 // The camera framing can preserve a title clipped by an otherwise useful artwork crop.
 title+='\n'+(await w.recognize(textRegion(source,'header','color'))).data.text;
 return {title,text,bottom,visual:visualMap(visual),features:visual.features,view:visual.matches[0]?.view,viewCount:views.length};
}
