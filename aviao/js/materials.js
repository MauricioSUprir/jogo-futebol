// Registro central de materiais: sombras em cascata (CSM), névoa com dispersão
// em volta do Sol e curvatura da Terra (o horizonte cai d²/2R, ~8 m a 10 km).
import * as THREE from 'three';

export const shared = {
  uSunView: { value: new THREE.Vector3(0, 1, 0) },
  uFogSunColor: { value: new THREE.Color(1, 0.9, 0.8) },
  uTime: { value: 0 },
  uNight: { value: 0 },
};

const FOG_PARS = /* glsl */`
#include <fog_pars_fragment>
uniform vec3 uSunView;
uniform vec3 uFogSunColor;
`;
const FOG_FRAG = /* glsl */`
#ifdef USE_FOG
  // névoa exponencial (perspectiva aérea): contraste cai 95% na distância de visibilidade
  float fogFactor = 1.0 - exp( - fogDensity * vFogDepth );
  vec3 fogViewDir = normalize( -vViewPosition );
  float fogSun = pow( max( dot( fogViewDir, uSunView ), 0.0 ), 8.0 );
  vec3 fogCol = mix( fogColor, uFogSunColor, fogSun );
  gl_FragColor.rgb = mix( gl_FragColor.rgb, fogCol, clamp( fogFactor, 0.0, 1.0 ) );
#endif
`;
// curvatura: calculada no espaço da câmera, funciona com instâncias
export const CURVE_VERT = /* glsl */`
#include <project_vertex>
{
  vec3 rel = transpose( mat3( viewMatrix ) ) * mvPosition.xyz;   // posição relativa à câmera, no mundo
  float drop = dot( rel.xz, rel.xz ) / 12742000.0;               // d² / 2R
  mvPosition.xyz -= mat3( viewMatrix ) * vec3( 0.0, drop, 0.0 );
  gl_Position = projectionMatrix * mvPosition;
}
`;

let csmRef = null;
export function setCSM(csm) { csmRef = csm; }

export function registerMaterial(mat, extra, key = '', { shadows = true } = {}) {
  if (csmRef && shadows) csmRef.setupMaterial(mat);
  const csmHook = mat.onBeforeCompile;
  mat.onBeforeCompile = (shader, renderer) => {
    if (csmHook) csmHook.call(mat, shader, renderer);
    shader.uniforms.uSunView = shared.uSunView;
    shader.uniforms.uFogSunColor = shared.uFogSunColor;
    shader.uniforms.uTime = shared.uTime;
    shader.uniforms.uNight = shared.uNight;
    shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>', CURVE_VERT);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <fog_pars_fragment>', FOG_PARS)
      .replace('#include <fog_fragment>', FOG_FRAG)
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nuniform float uNight;');
    if (extra) extra(shader);
  };
  mat.customProgramCacheKey = () => 'av-' + key + '-' + mat.type;
  return mat;
}
