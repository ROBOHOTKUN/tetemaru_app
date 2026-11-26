import * as T from './three.module.js';
import { GLTFLoader } from './GLTFLoader.js';
import { poses } from './character-motion.js';
import { greeting } from './greeting.js';

let modelPromise;
async function contactLight() {
  const response=await fetch('./pink-light.bin');
  if(!response.ok) throw Error('ぬいぐるみの陰影を読み込めません');
  const bytes=await response.arrayBuffer();
  const count=new Uint32Array(bytes,0,1)[0];
  const header=new Uint32Array(bytes,4,count*4);
  let offset=4+header.byteLength;
  const shadows=new Map();
  for(let i=0;i<header.length;i+=4){
    const n=header[i+2];
    const values=new Uint8Array(bytes,offset,n);
    const colors=new Uint8Array(n*3);
    values.forEach((value,j)=>colors.fill(value,j*3,j*3+3));
    shadows.set(header[i]+'/'+header[i+1],{colors:new T.BufferAttribute(colors,3,true),paw:Boolean(header[i+3])});
    offset+=n;
  }
  return shadows;
}
function loadModel() {
  if (!modelPromise) {
    modelPromise = Promise.all([new GLTFLoader().loadAsync('./pink-pal.glb'),contactLight()]).then(([{scene,parser},shadows]) => {
      scene.updateMatrixWorld(true);
      const bounds = new T.Box3();
      scene.traverse(part => {
        if (!part.isMesh) return;
        // Frame the rest shape rather than the bounds of the raised arm.
        const box = new T.Box3().setFromBufferAttribute(part.geometry.attributes.position);
        bounds.union(box.applyMatrix4(part.matrixWorld));
        part.castShadow = part.receiveShadow = true;
        const {meshes,primitives}=parser.associations.get(part);
        const light=shadows.get(meshes+'/'+primitives);
        if(light?.colors.count===part.geometry.attributes.position.count){
          part.geometry.setAttribute('color',light.colors);
          part.material.vertexColors=true;
          part.castShadow=!light.paw;
        }
        // The reference Blender scene uses the medium-high contrast AgX look.
        const beadEye=part.material.name==='Espresso';
        part.material.customProgramCacheKey=()=>beadEye?'bead-eye':'plush';
        part.material.onBeforeCompile = shader => {
          if(beadEye){
            // Keep the soft front-left catchlight, excluding fill and rim reflections.
            shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>', `
              vec3 keyHalfVector=normalize(normalize(vec3(-3.7,4.6,4.4))+vec3(0.,0.,1.));
              float keyFacing=max(dot(normal,keyHalfVector),0.0);
              float keyGloss=smoothstep(0.87,0.98,keyFacing);
              vec3 beadShade=diffuseColor.rgb*(0.72+0.65*max(normal.y,0.0));
              outgoingLight=mix(min(outgoingLight,beadShade),outgoingLight,keyGloss);
              outgoingLight+=vec3(0.18,0.16,0.14)*pow(keyFacing,42.0);
              #include <opaque_fragment>
            `);
          }
          shader.fragmentShader = shader.fragmentShader.replace('#include <tonemapping_fragment>', `
            #include <tonemapping_fragment>
            float luminance=dot(gl_FragColor.rgb,vec3(.2126,.7152,.0722));
            vec3 graded=mix(vec3(luminance),gl_FragColor.rgb,1.18);
            gl_FragColor.rgb=.18*pow(max(graded,vec3(0.))/.18,vec3(1.075));
          `);
        };
      });
      const center = bounds.getCenter(new T.Vector3());
      const height = bounds.max.y - bounds.min.y;
      const model = new T.Group();
      model.add(scene);
      scene.position.sub(center);
      model.scale.setScalar(2/height);
      return model;
    }).catch(error => { modelPromise = undefined; throw error; });
  }
  return modelPromise;
}

// Soft windows provide broad reflections on the eyes and amber antenna tips.
function studioTexture() {
  const width=256, height=128, data=new Uint16Array(width*height*4);
  const windows = [[-.64,.65,.72,.958,6],[.61,.48,.64,.965,4],[.43,.67,-.78,.96,4]];
  const dir=new T.Vector3();
  const panels=windows.map(([x,y,z,edge,power])=>({dir:new T.Vector3(x,y,z).normalize(),edge,power}));
  for(let y=0;y<height;y++){
    const latitude=((y+.5)/height-.5)*Math.PI;
    for(let x=0;x<width;x++){
      const longitude=((x+.5)/width-.5)*2*Math.PI;
      dir.set(Math.cos(latitude)*Math.cos(longitude),Math.sin(latitude),Math.cos(latitude)*Math.sin(longitude));
      let light=.12;
      for(const panel of panels) light+=panel.power*T.MathUtils.smoothstep(dir.dot(panel.dir),panel.edge,panel.edge+.009);
      const i=(y*width+x)*4;
      data.fill(T.DataUtils.toHalfFloat(light),i,i+3);
      data[i+3]=T.DataUtils.toHalfFloat(1);
    }
  }
  const texture=new T.DataTexture(data,width,height,T.RGBAFormat,T.HalfFloatType);
  texture.mapping=T.EquirectangularReflectionMapping;
  texture.needsUpdate=true;
  return texture;
}
const studio=studioTexture();
function lightModel(scene) {
  scene.environment=studio;
  function panel(x,y,z,power) {
    const lamp=new T.DirectionalLight(0xffffff,power);
    lamp.position.set(x,y,z);
    scene.add(lamp);
    return lamp;
  }
  const key=panel(-3.7,4.6,4.4,2.3);
  key.castShadow=true;
  key.shadow.mapSize.set(512,512);
  Object.assign(key.shadow.camera,{left:-1.6,right:1.6,top:1.6,bottom:-1.6,near:1,far:12});
  key.shadow.camera.updateProjectionMatrix();
  key.shadow.normalBias=.009;
  key.shadow.bias=-.00025;
  panel(3.5,2.9,3,1.12);
  panel(1.6,3.5,-3.8,1.65);
}

function poseModel(rig, wave, wink, blink, hug) {
  for (const {weights,targets} of rig) {
    if (targets.Wave !== undefined) weights[targets.Wave]=wave;
    if (targets.WaveArc !== undefined) weights[targets.WaveArc]=4*wave*(1-wave);
    if (targets.Wink !== undefined) weights[targets.Wink]=wink;
    if (targets.Blink !== undefined) weights[targets.Blink]=blink;
    if (targets.Hug !== undefined) weights[targets.Hug]=hug;
  }
}

class PlushPal extends HTMLElement{
 async connectedCallback(){
  this.innerHTML='<button type="button" class="model-button" aria-label="ててまる。左右にスワイプで回転、タップで反応する"><img src="./friend-front.png" alt=""><span aria-live="polite"></span></button>';
  const button=this.firstElementChild,reply=button.lastElementChild;
  let yaw=0,pitch=0,drag,dragged=false,start=-1,frame=0,renderer,observer,visibility;
  let returnTimer,returnPose=null,arrivalStart=null,spinDir=1;
  const animated=this.hasAttribute('data-motion');
  const host=this;   // data-resting="true" のあいだは、目を閉じてゆっくり息をする(きゅうけいちゅう)
  let visible=false,clip=this.dataset.motion==='intro'?'intro':'idle',epoch=0,pausedAt=0,lastPose=-1,revealed=false;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  this.cleanup=()=>{clearTimeout(returnTimer);cancelAnimationFrame(frame);observer?.disconnect();visibility?.disconnect();renderer?.dispose();renderer?.forceContextLoss()};
  try{
   const template=await loadModel();if(!this.isConnected || this.firstElementChild!==button)return;
   renderer=new T.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});
   renderer.toneMapping=T.AgXToneMapping;renderer.toneMappingExposure=1.25;
   renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
   renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setClearColor(0,0);
   const scene=new T.Scene(),camera=new T.OrthographicCamera(-1,1,1,-1,.1,10);
   camera.position.z=4;
   lightModel(scene);
   const pivot=new T.Group();scene.add(pivot);const mesh=new T.Group();pivot.add(mesh);
   const model=template.clone(true);mesh.add(model);
   const rig=[];
   model.traverse(part=>{
     if (part.morphTargetInfluences) rig.push({weights:part.morphTargetInfluences,targets:part.morphTargetDictionary});
   });
   button.prepend(renderer.domElement);
   function stopReturn(){
    clearTimeout(returnTimer);
    returnPose=null;
    arrivalStart=null;
   }
   function returnToFront(){
    stopReturn();
    if(!yaw&&!pitch)return;
    returnTimer=setTimeout(()=>{
     // 回された向きのまま、ぴょんと跳ねてくるっと回り、正面で着地する。
     // 少ししか回していなくても一回転して見せる(回しすぎたぶんは一回転以内に丸める)。
     const now=performance.now(),turn=2*Math.PI;
     const fromYaw=Math.atan2(Math.sin(yaw),Math.cos(yaw));
     let toYaw=spinDir>0?(fromYaw>0?turn:0):(fromYaw<0?-turn:0);
     if(Math.abs(toYaw-fromYaw)<turn*.4)toYaw+=spinDir*turn;
     const turns=Math.abs(toYaw-fromYaw)/turn;
     returnPose={fromYaw,toYaw,pitch,start:now,duration:560+420*turns};
     draw(now);
    },280);
   }
   // 跳ねて回る途中の高さと、着地のつぶれ(0〜1)
   function hopPose(t){
    const air=Math.min(1,t/.78);
    const land=t<.78?0:Math.sin(Math.PI*(t-.78)/.22);
    return {lift:.16*Math.sin(Math.PI*air),squash:land};
   }
   function placePivot(lift,squash){
    const sy=1-.09*squash,sx=1+.06*squash;
    pivot.scale.set(sx,sy,sx);
    pivot.position.y=lift*(animated?1:.4)-(animated?1.18:1)*(1-sy);   // つぶれても足の裏は床から離れない
   }
   const reveal=()=>{if(!revealed){revealed=true;this.dispatchEvent(new Event('pal-reveal'))}};
   // タップの反応: 何種類かから選ぶ(同じものは続けない)。いまの動きが終わるまで次は始めず、
   // そのあいだのタップは1回ぶんだけ覚えておいて、終わってから次の反応を出す。
   const KINDS=animated?['wave','happy','bounce','hug','sway']:['wave','bounce','sway'];
   const REACT_MS={bounce:1100,sway:1300};
   let reaction=null,queued=false,lastKind='';
   const busy=()=>Boolean(reaction)||(animated&&clip!=='idle')||Boolean(returnPose);
   function pickKind(){
    const options=KINDS.filter(k=>k!==lastKind);
    return lastKind=options[Math.floor(Math.random()*options.length)];
   }
   const react=kind=>{
    this.dispatchEvent(new CustomEvent('pal-tap',{detail:{kind}}));
    if(kind==='wave'){this.wave();return}
    if(kind==='happy'||kind==='hug'){this.playMotion(kind);return}
    const now=performance.now();
    reaction={kind,start:now,end:now+(reduced.matches?0:REACT_MS[kind])};
    if(!animated)reply.textContent='えへへ';
    draw(now);
   };
   function afterReaction(){
    if(!queued||busy())return;
    queued=false;
    setTimeout(()=>{if(busy())queued=true;else react(pickKind())},150);
   }
   function draw(time,force=true){
    cancelAnimationFrame(frame);const elapsed=Math.max(0,time-start);
    let lift=0,squash=0;
    if(returnPose){
     const t=reduced.matches?1:Math.min(1,Math.max(0,(time-returnPose.start)/returnPose.duration));
     // 回転は着地(t=.78)までに終え、少し行き過ぎてから正面に戻る
     const s=Math.min(1,t/.78),c=.9,u=s-1;
     const spin=1+(c+1)*u**3+c*u**2;
     yaw=returnPose.fromYaw+(returnPose.toYaw-returnPose.fromYaw)*spin;
     pitch=returnPose.pitch*(1-T.MathUtils.smoothstep(t,0,.5));
     ({lift,squash}=hopPose(t));
     if(t===1){
      yaw=0;pitch=0;lift=squash=0;
      returnPose=null;
      if(!reduced.matches)arrivalStart=time;
      queueMicrotask(afterReaction);
     }
     force=true;
    }
    let reactTilt=0,reactBlink=0,reactWink=0;
    const resting=host.dataset.resting==='true';
    if(resting){
     // すやすや: 目を閉じ、首を少しかしげて、ゆっくり大きく息をする
     const breath=reduced.matches?0:.5+.5*Math.sin(time*2*Math.PI/2800);
     squash=Math.max(squash,.45*breath);
     reactTilt=.16+(reduced.matches?0:.03*Math.sin(time*2*Math.PI/5600));
     reactBlink=1;
     force=true;
    }
    if(reaction&&reaction.kind!=='wave'){
     const t=reaction.end>reaction.start?Math.min(1,Math.max(0,(time-reaction.start)/(reaction.end-reaction.start))):1;
     if(reaction.kind==='bounce'){          // ぴょんぴょん: 2回跳ねて、うれしくて目を細める
      const p=t*2,k=p%1,h=p<1?1:.7;
      lift+=.13*h*Math.sin(Math.PI*Math.min(1,k/.85));
      squash=Math.max(squash,k>.85?Math.sin(Math.PI*(k-.85)/.15)*h:0);
      reactBlink=.55*Math.sin(Math.PI*t);
     }else{                                 // てれてれ: 首を左右にかしげてウインク
      reactTilt=.2*Math.sin(3*Math.PI*t)*Math.sin(Math.PI*t);
      reactWink=T.MathUtils.smoothstep(t,.25,.4)*(1-T.MathUtils.smoothstep(t,.7,.85));
     }
     if(t>=1){reaction=null;if(!animated)reply.textContent='';queueMicrotask(afterReaction)}
     force=true;
    }
    placePivot(lift,squash);
    const step=Math.floor(elapsed*24/1000);
    const waving=start>=0 && step<greeting.length;
    const [wave,wink]=waving?greeting[reduced.matches?10:step]:[0,0];
    let tilt=reactTilt,arrivalWink=0;
    if(arrivalStart!==null){
     const progress=Math.min(1,Math.max(0,(time-arrivalStart)/760));
     if(progress===1||reduced.matches||waving)arrivalStart=null;
     else{
      tilt+=.13*Math.sin(Math.PI*progress)**2;
      arrivalWink=T.MathUtils.smoothstep(progress,.12,.34)*(1-T.MathUtils.smoothstep(progress,.56,.82));
     }
     force=true;
    }
    if(animated){
     if(!visible)return;
     if(!epoch)epoch=time;
     const ticks=Math.max(0,Math.floor((time-epoch)*24/1000));
     if(clip==='intro' && (ticks>=12 || reduced.matches))reveal();
     if(clip!=='idle' && ticks>=poses[clip].length){epoch+=poses[clip].length*1000/24;clip='idle';lastPose=-1;queueMicrotask(afterReaction)}
     const i=reduced.matches?0:Math.max(0,Math.floor((time-epoch)*24/1000))%poses[clip].length;
     const [spin,lift,height,shift,blink,hug]=poses[reduced.matches?'idle':clip][i];
     const width=1/Math.sqrt(height);
     if(waving){mesh.scale.setScalar(1);mesh.position.set(0,-.18,0)}
     else{mesh.scale.set(width,height,width);mesh.position.set(shift,lift+height-1-.18,0)}
     pivot.rotation.set(pitch,yaw,tilt,'YXZ'); mesh.rotation.y=waving?0:spin;
     poseModel(rig,wave,Math.max(wink,arrivalWink,reactWink),waving?0:Math.max(blink*(1-arrivalWink),reactBlink),waving?0:hug);
     if(force || waving || lastPose!==i) renderer.render(scene,camera);
     lastPose=i;
     if(!reduced.matches)frame=requestAnimationFrame(()=>draw(performance.now(),false));
     return;
    }
    poseModel(rig,wave,Math.max(wink,arrivalWink,reactWink),reactBlink,0);
    mesh.rotation.set(pitch,yaw,tilt,'YXZ');renderer.render(scene,camera);
    if(waving||returnPose||arrivalStart!==null||reaction)frame=requestAnimationFrame(draw);
   }
   function resize(){
    const {width:w,height:h}=button.getBoundingClientRect();if(!w||!h)return;
    const half=Math.max(animated?1.27:1.09,.87*h/w);
    Object.assign(camera,{top:half,bottom:-half,left:-half*w/h,right:half*w/h});
    camera.updateProjectionMatrix();renderer.setSize(w,h,false);draw(performance.now());
   }
   this.playMotion=name=>{
    if(!animated || !Object.hasOwn(poses,name))return;
    start=-1;clearTimeout(this.timer);reply.textContent='';reaction=null;
    if(clip==='intro' && name!=='intro')reveal();
    clip=name;epoch=performance.now();if(!visible)pausedAt=epoch;lastPose=-1;draw(epoch);
   };
   if(animated){
    const setVisible=next=>{
     if(visible===next)return;
     const now=performance.now(); visible=next;
     if(next){
      if(epoch && pausedAt)epoch+=now-pausedAt;
      pausedAt=0;draw(now);
     }else{pausedAt=now;cancelAnimationFrame(frame)}
    };
    let inView=false;
    const refresh=()=>setVisible(inView && !document.hidden);
    const preference=()=>draw(performance.now());
    document.addEventListener('visibilitychange',refresh);
    reduced.addEventListener('change',preference);
    const cleanup=this.cleanup;
    this.cleanup=()=>{document.removeEventListener('visibilitychange',refresh);reduced.removeEventListener('change',preference);cleanup()};
    visibility=new IntersectionObserver(([entry])=>{
     inView=entry.isIntersecting;refresh();

    });
    visibility.observe(this);
   }
   observer=new ResizeObserver(resize);observer.observe(button);resize();button.classList.add('ready');
   button.onpointerdown=e=>{if(drag || !e.isPrimary || e.button!==0)return;stopReturn();drag={id:e.pointerId,x:e.clientX,y:e.clientY,yaw,pitch};dragged=false;button.setPointerCapture(e.pointerId)};
   button.onpointermove=e=>{if(drag?.id!==e.pointerId)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.hypot(dx,dy)>(e.pointerType==="touch"?7:4))dragged=true;if(dragged){yaw=drag.yaw+dx*.018;pitch=Math.max(-.55,Math.min(.55,drag.pitch+dy*.012));draw(performance.now())}};
   button.onpointerup=e=>{if(drag?.id!==e.pointerId)return;spinDir=Math.sign(yaw-drag.yaw)||spinDir;drag=null;if(!dragged)respond();returnToFront()};
   button.onlostpointercapture=button.onpointercancel=e=>{if(drag?.id===e.pointerId){drag=null;dragged=true;returnToFront()}};
   button.onkeydown=e=>{if(!drag&&(e.key==='ArrowLeft'||e.key==='ArrowRight')){e.preventDefault();stopReturn();spinDir=e.key==='ArrowLeft'?-1:1;yaw+=spinDir*.32;draw(performance.now());returnToFront()}};
   button.onclick=e=>{if(e.detail===0) respond()};
   const respond=()=>{if(host.dataset.resting==='true')return;if(busy()){queued=true;return}react(pickKind())};
   this.wave=()=>{if(!animated)reply.textContent='えへへ';clearTimeout(this.timer);start=performance.now();reaction={kind:'wave'};draw(start);this.timer=setTimeout(()=>{reply.textContent='';start=-1;reaction=null;draw(performance.now());afterReaction()},greeting.length*1000/24)};
  }catch(e){if(this.dataset.motion==='intro')this.dispatchEvent(new Event('pal-reveal'));reply.textContent='3D表示を利用できません';console.warn('ててまる3D',e)}
 }
 disconnectedCallback(){this.cleanup?.();clearTimeout(this.timer)}
}
customElements.define('plush-pal',PlushPal);
