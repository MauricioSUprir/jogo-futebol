// Registro central de materiais: sombras em cascata (CSM) + névoa de poeira com
// dispersão para frente (o pó marciano espalha a luz em volta do Sol).
import * as THREE from 'three';

export const shared = {
  uSunView: { value: new THREE.Vector3(0, 1, 0) },     // direção do Sol no espaço da câmera
  uFogSunColor: { value: new THREE.Color(1, 0.9, 0.8) },
  uTime: { value: 0 },
};

const FOG_PARS = /* glsl */`
#include <fog_pars_fragment>
uniform vec3 uSunView;
uniform vec3 uFogSunColor;
`;
const FOG_FRAG = /* glsl */`
#ifdef USE_FOG
  #ifdef FOG_EXP2
    float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
  #else
    float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
  #endif
  vec3 fogViewDir = normalize( -vViewPosition );
  float fogSun = pow( max( dot( fogViewDir, uSunView ), 0.0 ), 5.0 );
  vec3 fogCol = mix( fogColor, uFogSunColor, fogSun );
  gl_FragColor.rgb = mix( gl_FragColor.rgb, fogCol, clamp( fogFactor, 0.0, 1.0 ) );
#endif
`;

let csmRef = null;
const registered = [];
export function setCSM(csm) { csmRef = csm; }

/**
 * Prepara um MeshStandardMaterial/MeshPhysicalMaterial para o mundo:
 * sombras CSM, névoa marciana e um patch extra opcional (shader => void).
 */
export function registerMaterial(mat, extra, key = '') {
  if (csmRef) csmRef.setupMaterial(mat);
  const csmHook = mat.onBeforeCompile;
  mat.onBeforeCompile = (shader, renderer) => {
    if (csmHook) csmHook.call(mat, shader, renderer);
    shader.uniforms.uSunView = shared.uSunView;
    shader.uniforms.uFogSunColor = shared.uFogSunColor;
    shader.uniforms.uTime = shared.uTime;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <fog_pars_fragment>', FOG_PARS)
      .replace('#include <fog_fragment>', FOG_FRAG);
    if (extra) extra(shader);
  };
  mat.customProgramCacheKey = () => 'jz-' + key + '-' + mat.type;
  registered.push(mat);
  return mat;
}

export function allMaterials() { return registered; }
