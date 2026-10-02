// GLSL da torcida 3D: pose procedural por torcedor (tudo na GPU) e "esqueleto"
// rígido por partes. A pose depende só de uniforms compartilhados (uTime, uExc,
// uEvHome/uEvAway) e da semente de cada instância — nenhum laço por torcedor na CPU.
import { J } from './stadium-crowd-body.js';

const v3 = (a) => `vec3( ${a.map((x) => x.toFixed(4)).join(', ')} )`;

export const POSE_GLSL = /* glsl */`
uniform float uTime;
uniform float uExc;
uniform vec4 uEvHome;   // instante (s) do último: gol, chance, falta, defesa
uniform vec4 uEvAway;
uniform vec4 uChant;    // x = canto da casa (0..1), y = canto visitante, z = bpm casa, w = bpm visitante
uniform vec4 uWave;     // ola: x = início (s), y = sentido (±1), z = velocidade (m/s), w = voltas
uniform float uDebugPose;

float h11( float n ) { return fract( sin( n * 91.3458 ) * 47453.5453 ); }
// envelope de reação: sobe rápido, dura "dur" segundos
float react( float t0, float dur ) {
  float t = uTime - t0;
  return t < 0.0 ? 0.0 : smoothstep( 0.0, 0.3, t ) * ( 1.0 - smoothstep( dur * 0.55, dur, t ) );
}

// body: x = de pé (0..1), y = pulo (m), z = inclinação p/ frente (rad), w = inclinação lateral
// head: x = giro da cabeça, y = cabeça p/ baixo, z = giro do tronco,
//       w = cachecol (0 no pescoço, 1 esticado acima da cabeça, 2 girando)
// armA (lado +x) / armB (lado -x): x = elevação (0 caído, ~3 p/ cima), y = abertura,
//       z = flexão do cotovelo, w = torção do braço (negativo = antebraço p/ dentro)
struct Pose { vec4 body; vec4 head; vec4 armA; vec4 armB; };

Pose mixPose( Pose a, Pose b, float w ) {
  return Pose( mix( a.body, b.body, w ), mix( a.head, b.head, w ), mix( a.armA, b.armA, w ), mix( a.armB, b.armB, w ) );
}

// flags: 1 visitante, 2 anel superior, 4 organizada (em pé, canta), 8 tem cachecol, 16 fica de pé
Pose crowdPose( vec3 wp, float seed, float flags ) {
  float r1 = h11( seed * 13.1 + 0.1 ), r2 = h11( seed * 27.7 + 1.3 ), r3 = h11( seed * 5.3 + 2.7 );
  float r4 = h11( seed * 41.9 + 3.1 ), r5 = h11( seed * 71.3 + 4.9 ), r6 = h11( seed * 17.9 + 5.5 );
  float r7 = h11( seed * 33.3 + 6.1 ), r8 = h11( seed * 57.7 + 7.7 );
  float away = mod( flags, 2.0 );
  float ultra = mod( floor( flags / 4.0 ), 2.0 );
  float scarf = mod( floor( flags / 8.0 ), 2.0 );
  float stander = mod( floor( flags / 16.0 ), 2.0 );
  float t = uTime;
  // blocos de ~8 m cantam/batem palmas juntos
  float blockId = floor( wp.x / 8.0 ) * 7.0 + floor( wp.z / 8.0 ) * 13.0 + floor( wp.y / 3.5 ) * 3.0;
  float bk = h11( blockId + 0.37 );
  float TAU = 6.2831853;

  vec4 evM = away > 0.5 ? uEvAway : uEvHome;
  vec4 evO = away > 0.5 ? uEvHome : uEvAway;
  if ( uDebugPose > -0.5 ) { evM = vec4( -1e4 ); evO = vec4( -1e4 ); }
  float dl = r2 * 0.6;                                     // tempo de reação de cada um
  float goal = react( evM.x + dl * 0.6, 17.0 + r3 * 5.0 );
  float tg = t - evM.x - dl;                               // segundos desde o gol
  float sad = react( evO.x + dl * 1.6, 9.0 + r4 * 5.0 );
  float onHead = max( react( evM.y + dl * 0.5, 4.6 + r5 * 1.4 ), react( evO.w + dl * 0.5, 3.4 + r5 ) * 0.9 );
  float applause = react( evM.w + dl, 3.4 + r6 * 1.5 );
  float foul = react( evM.z + dl, 3.0 + r7 );
  float exc = uExc;
  bool dbg = uDebugPose > -0.5;

  // ------------------------------------------------ repouso
  float breath = sin( t * ( 1.1 + r3 * 0.5 ) + r1 * 30.0 );
  // "acompanhando o lance": vizinhos olham para o mesmo lado, cada um com seu atraso
  float follow = sin( t * 0.23 + wp.x * 0.013 + r2 * 0.7 ) * 0.42 + sin( t * 0.61 + r4 * 20.0 ) * 0.14;
  float glance = smoothstep( 0.86, 0.96, sin( t * ( 0.11 + r5 * 0.09 ) + r6 * 40.0 ) ) * ( r7 < 0.5 ? -0.9 : 0.9 );
  float stand0 = max( stander, ultra * step( 0.12, r3 ) );
  Pose p;
  p.body = vec4( stand0, 0.0, 0.05 + 0.12 * r4 + breath * 0.015, ( r5 - 0.5 ) * 0.08 );
  p.head = vec4( follow + glance, 0.12 + 0.1 * r6, ( r7 - 0.5 ) * 0.16 + glance * 0.25, 0.0 );
  vec4 aSit;
  if ( r5 < 0.42 ) aSit = vec4( 0.42, 0.04, 1.2, -0.55 );          // mãos no colo
  else if ( r5 < 0.66 ) aSit = vec4( 0.66, -0.1, 2.0, -1.45 );      // braços cruzados
  else aSit = vec4( 0.2, 0.2, 0.8, -0.35 );                         // soltos
  vec4 aStand = vec4( 0.08 + 0.1 * r6, 0.1, 0.2 + 0.35 * r6, -0.25 );
  p.armA = mix( aSit, aStand, stand0 );
  p.armB = p.armA + vec4( ( r7 - 0.5 ) * 0.12, ( r8 - 0.5 ) * 0.08, 0.0, 0.0 );
  if ( r5 > 0.9 ) { p.armA = vec4( 0.5, -0.05, 2.6, -0.8 ); p.body.z += 0.2; }   // mão no queixo

  // ------------------------------------------------ tensão (jogo pegado): inclina, levanta
  float thr = 0.42 + 0.5 * r1;
  float up = smoothstep( thr, thr + 0.1, exc );
  Pose pt = p;
  if ( exc > 0.3 || dbg ) {
    pt.body.x = max( p.body.x, up );
    pt.body.z = mix( p.body.z + 0.2 + 0.12 * r2, 0.08, up );
    pt.head.y = 0.02;
    if ( r6 < 0.45 ) { pt.armA = vec4( 0.8, -0.06, 2.4, -1.15 ); pt.armB = pt.armA; }  // mãos na boca
    p = mixPose( p, pt, smoothstep( 0.3, 0.8, exc ) );
  }

  // ------------------------------------------------ canto (~130 bpm casa, ~120 visitante)
  // Os blocos de ~8 m ficam quase em fase (atraso de até 0,08 batida): de longe a
  // arquibancada inteira "pulsa" junto, que é o que a câmera de TV consegue mostrar.
  float bpm = away > 0.5 ? uChant.w : uChant.z;
  float beat = t * bpm / 60.0 + bk * 0.08 + r1 * 0.03;
  float bOn = pow( max( sin( beat * TAU ), 0.0 ), 1.6 );          // impulso em cada batida
  float bSw = sin( beat * 3.14159 );                               // balanço: um lado por batida
  float lvl = away > 0.5 ? uChant.y : uChant.x;
  float joinC = smoothstep( r3 - 0.12, r3 + 0.05, lvl * 1.12 ) * step( 0.06, r5 );
  float chant = max( ultra, joinC );
  chant = max( chant, smoothstep( 0.7, 0.9, exc ) * step( 0.45, bk ) * step( 0.25, r3 ) );
  Pose pc = p;
  if ( chant > 0.001 || goal > 0.001 || dbg ) {
    pc.body.x = 1.0;
    pc.body.z = 0.02;
    pc.head.y = -0.12;
    if ( away > 0.5 ) {
      // visitante: braços erguidos balançando de um lado para o outro, corpo junto
      pc.body.w = 0.16 * bSw;
      pc.body.y = 0.05 * bOn * step( 0.4, r4 );
      if ( scarf > 0.5 && r6 < 0.6 ) { pc.armA = vec4( 2.75, 0.5 + 0.1 * bSw, 0.12, 0.0 ); pc.armB = pc.armA; pc.head.w = 1.0; }
      else if ( r6 < 0.75 ) {
        pc.armA = vec4( 2.65, 0.25 + 0.35 * bSw, 0.25, 0.0 );
        pc.armB = vec4( 2.65, 0.25 - 0.35 * bSw, 0.25, 0.0 );
      } else {
        float cl = pow( abs( sin( beat * 3.14159 ) ), 3.0 );       // palmas acima da cabeça
        pc.armA = vec4( 2.5, -0.02 + 0.32 * ( 1.0 - cl ), 0.75, -1.25 ); pc.armB = pc.armA;
      }
    } else {
      // casa: pula em cada batida (organizada pula mais), soco no ar, cachecol esticado
      pc.body.y = ( 0.1 + 0.12 * ultra ) * bOn * step( 0.22, r4 );
      if ( scarf > 0.5 && r6 < 0.7 ) {
        pc.armA = vec4( 2.75 + 0.2 * bOn, 0.52, 0.12, 0.0 ); pc.armB = pc.armA; pc.head.w = 1.0;
      } else if ( r6 < 0.6 ) {
        pc.armA = vec4( 1.9 + 1.05 * bOn, 0.28, 1.3 - 1.15 * bOn, 0.0 );
        pc.armB = r7 < 0.5 ? vec4( 0.3, 0.14, 0.6, -0.3 ) : pc.armA;
      } else {
        float cl = pow( abs( sin( beat * 3.14159 ) ), 3.0 );
        pc.armA = vec4( 2.55, -0.02 + 0.32 * ( 1.0 - cl ), 0.75, -1.25 ); pc.armB = pc.armA;
      }
    }
    p = mixPose( p, pc, chant * ( 1.0 - sad ) );
  }

  // ------------------------------------------------ ola (onda que corre o estádio)
  // Farkas et al. (Nature, 2002): ~12 m/s (≈20 cadeiras/s), largura de 6-12 m, gira
  // no sentido horário. Cada um levanta rápido quando a frente chega e senta devagar.
  float ola = 0.0;
  if ( uWave.x > -1e3 && !dbg ) {
    float th = atan( wp.z / 1.5, -wp.x );                          // 0 no fundo oeste
    float sArc = mod( th * uWave.y, TAU ) * 66.0;                  // ~perímetro do anel (m)
    float run = ( t - uWave.x ) * uWave.z - sArc - r2 * 1.6;
    if ( run > -3.0 && run < uWave.w * TAU * 66.0 + 9.0 ) {
      float x = run - TAU * 66.0 * floor( ( run + 3.0 ) / ( TAU * 66.0 ) );
      ola = smoothstep( -3.5, 0.0, x ) * ( 1.0 - smoothstep( 3.5, 10.0, x ) );
    }
  }
  if ( ola > 0.001 ) {
    Pose po = p;
    // no pico: salto curto com os braços em "V" bem abertos (silhueta muda muito de longe)
    po.body = vec4( 1.0, 0.26 * smoothstep( 0.75, 1.0, ola ), -0.08, 0.0 );
    po.head = vec4( 0.0, -0.35, 0.0, scarf > 0.5 ? 1.0 : 0.0 );
    po.armA = vec4( 2.95, 0.45 + 0.12 * r7, 0.1, 0.0 ); po.armB = po.armA;
    p = mixPose( p, po, ola * ( 1.0 - sad ) );
  }

  // ------------------------------------------------ palmas espontâneas (por bloco)
  float cw = smoothstep( 0.8, 0.9, sin( t * 0.08 + bk * 30.0 ) ) * step( 0.3, r2 );
  cw = max( cw, smoothstep( 0.5, 0.8, exc ) * step( 0.72, r3 ) * ( 1.0 - chant ) );
  float co = sin( t * ( 11.0 + r4 * 3.0 ) + r1 * 6.0 );
  Pose pcl = p;
  if ( cw > 0.001 || dbg ) {
    pcl.armA = vec4( 0.7 + 0.12 * r2, 0.02, 1.62, -0.78 + 0.45 * max( co, 0.0 ) ); pcl.armB = pcl.armA;
    p = mixPose( p, pcl, cw * ( 1.0 - chant ) );
  }

  // ------------------------------------------------ falta: protesto, braços agitando
  float w1 = sin( t * ( 6.0 + 3.0 * r2 ) + r1 * 9.0 );
  Pose pf = p;
  if ( foul > 0.001 || dbg ) {
    pf.body.x = max( p.body.x, step( 0.3, r3 ) );
    pf.body.z = 0.18;
    pf.head.y = -0.05;
    pf.armA = vec4( 2.0 + 0.45 * w1, 0.5 + 0.3 * w1, 0.5 + 0.4 * sin( t * 5.0 + r3 * 7.0 ), 0.0 );
    pf.armB = r6 < 0.5 ? vec4( 1.6, 0.05, 0.05, 0.0 ) : vec4( 2.0 - 0.45 * w1, 0.5 - 0.3 * w1, 0.6, 0.0 );
    p = mixPose( p, pf, foul );
  }

  // ------------------------------------------------ defesa do nosso goleiro: aplausos
  float ca = sin( t * ( 12.0 + 4.0 * r4 ) + r1 * 6.0 );
  Pose pa = p;
  if ( applause > 0.001 || dbg ) {
    pa.body.x = max( p.body.x, step( 0.45, r4 ) );
    pa.body.z = 0.05;
    pa.armA = vec4( 0.95 + 0.25 * r2, 0.02, 1.7, -0.8 + 0.45 * max( ca, 0.0 ) ); pa.armB = pa.armA;
    p = mixPose( p, pa, applause );
  }

  // ------------------------------------------------ quase gol: mãos na cabeça
  Pose ph = p;
  if ( onHead > 0.001 || dbg ) {
    ph.body.x = max( p.body.x, step( 0.15, r1 ) );
    ph.body.z = -0.06;
    ph.head.y = -0.12 + 0.3 * step( 0.7, r3 );
    ph.head.z = ( r7 - 0.5 ) * 0.5;
    ph.armA = vec4( 3.0, 0.95, 2.1, -1.6 ); ph.armB = ph.armA;
    if ( r8 < 0.2 ) ph.armB = vec4( 1.6, 0.15, 0.1, 0.0 );          // aponta para o lance
    p = mixPose( p, ph, onHead );
  }

  // ------------------------------------------------ gol do adversário: desânimo
  Pose ps = p;
  if ( sad > 0.001 || dbg ) {
    ps.body.x = stand0 * 0.4 * step( 0.75, r2 );
    ps.body.y = 0.0;
    ps.body.z = 0.42 + 0.12 * r3;
    ps.head = vec4( p.head.x * 0.3, 0.5 + 0.1 * r4, p.head.z * 0.3, 0.0 );
    if ( r6 < 0.4 ) { ps.armA = vec4( 1.05, 0.25, 2.55, -1.1 ); ps.armB = ps.armA; }   // mãos no rosto
    else { ps.armA = vec4( 0.2, 0.06, 0.5, -0.2 ); ps.armB = ps.armA; }
    p = mixPose( p, ps, sad );
  }

  // ------------------------------------------------ gol: explosão
  // pulos da explosão: ~150 bpm, blocos em fase (de longe vira a arquibancada "fervendo")
  float gph = t * 2.5 * 3.14159 + bk * 1.2 + r1 * 0.5 + step( 0.8, r3 ) * 1.5;
  float pump = 0.5 + 0.5 * sin( gph * 2.0 );
  Pose pg = p;
  if ( goal > 0.001 || dbg ) {
    pg.body = vec4( 1.0, pow( abs( sin( gph ) ), 1.4 ) * ( 0.22 + 0.2 * r4 ) * ( 1.0 - 0.6 * smoothstep( 6.0, 11.0, tg ) ), -0.1, 0.0 );
    pg.head = vec4( ( r7 - 0.5 ) * 0.4, -0.35, ( r8 - 0.5 ) * 0.3, 0.0 );
    float st = r6;
    if ( scarf > 0.5 && st < 0.6 ) {
      // gira o cachecol acima da cabeça
      pg.armA = vec4( 2.95, 0.12, 0.15, 0.0 );
      pg.armB = vec4( 2.5, 0.45, 0.4 + 1.0 * pump, 0.0 );
      pg.head.w = 2.0;
    } else if ( st < 0.42 ) {
      pg.armA = vec4( 2.8, 0.42, 0.2 + 1.2 * pump, 0.0 );              // punhos para cima
      pg.armB = vec4( 2.8, 0.42, 0.2 + 1.2 * ( 1.0 - pump ), 0.0 );
    } else if ( st < 0.56 ) {
      // abraçado com os vizinhos, balançando junto
      float sw = sin( t * 3.0 + bk * 6.0 );
      pg.armA = vec4( 0.3, 1.15, 1.2, 1.2 ); pg.armB = pg.armA;
      pg.body.w = 0.2 * sw;
      pg.body.y = pow( max( sin( t * 5.5 + bk * 3.0 ), 0.0 ), 2.0 ) * 0.14 * ( 1.0 - smoothstep( 5.0, 9.0, tg ) );
    } else if ( st < 0.82 ) {
      pg.armA = vec4( 1.85, 1.05, 0.2, 0.0 ); pg.armB = pg.armA;        // braços abertos, gritando
      pg.head.y = -0.5;
    } else {
      float cl = abs( sin( t * 9.0 + r1 * 5.0 ) );                     // palmas acima da cabeça
      pg.armA = vec4( 2.6, -0.02 + 0.3 * cl, 0.7, -1.25 ); pg.armB = pg.armA;
    }
    // depois da explosão, vira canto/palmas
    pg = mixPose( pg, pc, smoothstep( 8.0, 11.0, tg - r2 * 2.0 ) * 0.85 );
    p = mixPose( p, pg, goal );
  }

  // ------------------------------------------------ depuração (página de teste)
  if ( uDebugPose > -0.5 ) {
    float k = floor( uDebugPose + 0.5 );
    if ( k == 1.0 ) p = pt; else if ( k == 2.0 ) p = pc; else if ( k == 3.0 ) p = pcl;
    else if ( k == 4.0 ) p = pf; else if ( k == 5.0 ) p = pa; else if ( k == 6.0 ) p = ph;
    else if ( k == 7.0 ) p = ps; else if ( k == 8.0 ) p = pg;
  }
  return p;
}
`;

export const SKIN_GLSL = /* glsl */`
mat3 rX( float a ) { float c = cos( a ), s = sin( a ); return mat3( 1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c ); }
mat3 rY( float a ) { float c = cos( a ), s = sin( a ); return mat3( c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c ); }
mat3 rZ( float a ) { float c = cos( a ), s = sin( a ); return mat3( c, s, 0.0, -s, c, 0.0, 0.0, 0.0, 1.0 ); }
const vec3 J_SH = ${v3(J.shoulder)};
const vec3 J_EL = ${v3(J.elbow)};
const vec3 J_NECK = ${v3(J.neck)};
const vec3 J_HIP = ${v3(J.hip)};
const vec3 J_KNEE = ${v3(J.knee)};
const vec3 J_HAND = ${v3([J.handTip[0], J.handTip[1] + 0.04, J.handTip[2]])};
const vec3 J_HEAD = ${v3(J.head)};
const vec3 J_HEADR = ${v3(J.headR)};
const float PELVIS_Y = ${J.pelvisY.toFixed(3)};

// Leva um vértice da pose de referência para a pose P (espaço local do torcedor,
// pés na origem). part: 1 tronco, 2 cabeça, 3 aba, 4/5 braço/antebraço +x,
// 6/7 braço/antebraço -x, 8/9 coxas, 10/11 canelas. seg = 1 se o braço é um segmento só (baixa).
void bodyXform( Pose P, vec3 rest, vec3 nrm, float part, float seg, out vec3 pos, out vec3 n ) {
  float st = P.body.x;
  float mir = ( ( part > 5.5 && part < 7.5 ) || ( part > 8.5 && part < 9.5 ) || part > 10.5 ) ? -1.0 : 1.0;
  vec3 r = rest, nr = nrm;
  r.x *= mir; nr.x *= mir;
  // pelve: sentado (0,47 m, encostado) ou de pé (0,93 m, um passo à frente)
  vec3 pel = vec3( 0.0, mix( 0.47, PELVIS_Y, st ) + P.body.y, mix( -0.04, 0.08, st ) );
  vec3 q, qn;
  if ( part > 7.5 ) {
    // coxa: horizontal sentado, vertical de pé (encolhe no pulo); canela sempre caindo
    float a = mix( 1.5, 0.05, st ) + P.body.y * 1.6;
    mat3 R = rX( -a ) * rZ( 0.05 + 0.07 * ( 1.0 - st ) );
    if ( part < 9.5 ) { q = R * ( r - J_HIP ); qn = R * nr; }
    else {
      mat3 Rk = R * rX( a * 0.97 + P.body.y * 1.2 );
      q = R * ( J_KNEE - J_HIP ) + Rk * ( r - J_KNEE ); qn = Rk * nr;
    }
    q += vec3( J_HIP.x, 0.0, 0.0 );
    q.x *= mir; qn.x *= mir;
    pos = pel + q; n = qn;
    return;
  }
  if ( part > 3.5 ) {
    vec4 a = mir > 0.0 ? P.armA : P.armB;
    mat3 Rs = rX( -a.x ) * rZ( a.y );
    bool fore = ( part > 4.5 && part < 5.5 ) || part > 6.5;
    if ( !fore ) {
      // baixa: braço reto de um segmento só (cotovelo meio dobrado)
      mat3 R1 = seg > 0.5 ? Rs * rY( a.w ) * rX( -a.z * 0.35 ) : Rs;
      q = J_SH + R1 * ( r - J_SH ); qn = R1 * nr;
    } else {
      mat3 Rf = Rs * rY( a.w ) * rX( -a.z );
      q = J_SH + Rs * ( J_EL - J_SH ) + Rf * ( r - J_EL ); qn = Rf * nr;
    }
  } else if ( part > 1.5 ) {
    mat3 Rh = rY( P.head.x ) * rX( P.head.y );
    q = J_NECK + Rh * ( r - J_NECK ); qn = Rh * nr;
  } else { q = r; qn = nr; }
  q.x *= mir; qn.x *= mir;
  mat3 Rt = rY( P.head.z ) * rX( P.body.z ) * rZ( P.body.w );
  q.y -= PELVIS_Y;
  pos = pel + Rt * q; n = Rt * qn;
}

vec3 bodyPoint( Pose P, vec3 rest, float part ) {
  vec3 p, n;
  bodyXform( P, rest, vec3( 0.0, 1.0, 0.0 ), part, 0.0, p, n );
  return p;
}
`;

// ---------------------------------------------------------------- material
// Instâncias: aP (x, y, z, d), aN (nx, nz, semente, flags) e cores em bytes.
const INSTANCE_DECL = /* glsl */`
attribute vec4 aP;
attribute vec4 aN;
attribute vec4 aShirt;   // camisa rgb, padrão/32
attribute vec4 aSecond;  // cor 2 rgb, manga/32
attribute vec4 aSkin;    // pele rgb, cabelo/32
attribute vec4 aHair;    // cabelo/boné rgb, largura
attribute vec4 aPants;   // calça rgb, altura
uniform float uDirScale;
varying vec3 vColA;
varying vec3 vColB;
varying vec3 vRest;
varying vec4 vInfo;      // parte, estilo, oclusão, luz direta
`;

// monta a base do torcedor no mundo: frente virada para o campo
const FRAME_GLSL = /* glsl */`
  vec3 nOut = vec3( aN.x, 0.0, aN.y );
  float seed = aN.z;
  vec2 tc = vec2( clamp( aP.x, -38.0, 38.0 ), clamp( aP.z, -18.0, 18.0 ) ) - aP.xz;
  vec3 F = normalize( -nOut + vec3( tc.x, 0.0, tc.y ) * ( 0.35 / max( length( tc ), 1.0 ) ) + ( h11( seed * 3.7 ) - 0.5 ) * 0.25 * vec3( nOut.z, 0.0, -nOut.x ) );
  vec3 X = vec3( F.z, 0.0, -F.x );
  float hgt = 0.86 + 0.24 * aPants.w;
  if ( aPants.w < 0.02 ) hgt = 0.74;                        // criança
  float wid = 0.9 + 0.25 * aHair.w;
  float dCam = distance( cameraPosition, aP.xyz + vec3( 0.0, 1.0, 0.0 ) );
  float vis = smoothstep( 5.2, 6.5, dCam );                 // some perto da câmera
  Pose P = crowdPose( aP.xyz, seed, aN.w );
`;

const toWorld = /* glsl */`
  vec3 s2l( vec3 c ) { return pow( c, vec3( 2.2 ) ); }
  vec3 toW( vec3 lp, float hgt, float wid, vec3 X, vec3 F, float vis ) {
    return ( X * lp.x * wid + vec3( 0.0, lp.y * hgt, 0.0 ) + F * lp.z * wid ) * vis;
  }
`;

export const BODY_VERT_HEAD = /* glsl */`
${INSTANCE_DECL}
attribute float aPart;
uniform float uSegArm;
${POSE_GLSL}
${SKIN_GLSL}
${toWorld}
`;

export const BODY_VERT_MAIN = /* glsl */`
  vec3 objectNormal; vec3 crowdPos;
  {
    ${FRAME_GLSL}
    float part = aPart;
    vec3 rest = position;
    float hs = floor( aSkin.w * 255.0 / 32.0 + 0.5 );       // estilo do cabelo
    if ( part > 1.5 && part < 2.5 ) {
      if ( hs > 4.5 ) rest = J_HEAD + ( rest - J_HEAD ) * vec3( 1.2, 1.14, 1.16 );          // black power
      else if ( hs > 1.5 && hs < 2.5 ) rest += vec3( 0.0, -0.02, -0.03 ) * step( rest.y, J_HEAD.y ) * step( rest.z, J_HEAD.z );
    }
    if ( part > 2.5 && part < 3.5 && abs( hs - 4.0 ) > 0.5 ) rest = J_HEAD;                 // sem boné: some a aba
    vec3 lp, ln;
    bodyXform( P, rest, normal, part, uSegArm, lp, ln );
    crowdPos = aP.xyz + toW( lp, hgt, wid, X, F, vis );
    objectNormal = normalize( X * ln.x / wid + vec3( 0.0, ln.y / hgt, 0.0 ) + F * ln.z / wid );
    vRest = position;
    vec3 shirt = s2l( aShirt.rgb ), second = s2l( aSecond.rgb ), skin = s2l( aSkin.rgb ), hair = s2l( aHair.rgb ), pants = s2l( aPants.rgb );
    float style = 0.0;
    if ( part < 1.5 ) { vColA = shirt; vColB = second; style = floor( aShirt.w * 255.0 / 32.0 + 0.5 ); }
    else if ( part < 2.5 ) { vColA = skin; vColB = hair; style = hs; }
    else if ( part < 3.5 ) { vColA = hair; vColB = hair; }
    else if ( part < 7.5 ) {
      // manga: 0 camiseta, 1 manga comprida/jaqueta, 2 regata
      float sl = floor( aSecond.w * 255.0 / 32.0 + 0.5 );
      vColA = shirt; vColB = skin;
      style = sl < 0.5 ? 1.24 : sl < 1.5 ? 0.9 : 1.42;
    } else { vColA = pants; vColB = h11( seed * 5.1 ) < 0.4 ? vec3( 0.75 ) : vec3( 0.025 ); style = 0.13; }   // calça e tênis
    // oclusão: parte de baixo do corpo fica no escuro entre as fileiras
    float ao = mix( 0.42, 1.0, smoothstep( 0.35, 1.45, lp.y ) );
    vInfo = vec4( part, style, ao * ( 0.9 + 0.2 * h11( seed * 9.1 ) ), roofLit( aP.w, crowdPos.y, aN.xy ) * uDirScale );
    if ( vis < 0.01 ) crowdPos = aP.xyz;
  }
`;

// Cachecol: faixa ligada às mãos (esticado / girando) ou pendurada no pescoço.
export const SCARF_VERT_HEAD = /* glsl */`
${INSTANCE_DECL}
${POSE_GLSL}
${SKIN_GLSL}
${toWorld}
`;

export const SCARF_VERT_MAIN = /* glsl */`
  vec3 objectNormal; vec3 crowdPos;
  {
    ${FRAME_GLSL}
    float u = position.x, side = position.y;
    // 0: no pescoço, caindo sobre o peito (segue o tronco)
    float s = u * 2.0 - 1.0;
    vec3 rest0 = vec3( sign( s ) * 0.07 + ( side - 0.5 ) * 0.075, J_NECK.y - 0.03 - abs( s ) * 0.5, 0.125 - abs( s ) * 0.02 );
    vec3 p0 = bodyPoint( P, rest0, 1.0 );
    vec3 n0 = bodyPoint( P, rest0 + vec3( 0.0, 0.0, 0.1 ), 1.0 ) - p0;
    vec3 hA = bodyPoint( P, J_HAND, 5.0 );
    vec3 hB = bodyPoint( P, J_HAND * vec3( -1.0, 1.0, 1.0 ), 7.0 );
    // 1: esticado entre as mãos, acima da cabeça
    vec3 p1 = mix( hA, hB, u ) + vec3( 0.0, -0.08 * sin( 3.14159 * u ) - side * 0.19, 0.0 );
    p1.z += 0.03 * sin( uTime * 3.0 + u * 5.0 + seed * 20.0 );
    vec3 n1 = vec3( 0.0, 0.0, 1.0 );
    // 2: girando preso numa das mãos
    float ang = uTime * ( 9.0 + 3.0 * h11( seed * 2.1 ) ) + seed * 40.0 - u * 1.4;
    vec3 rad = vec3( cos( ang ), 0.0, sin( ang ) );
    vec3 p2 = hA + rad * u * 1.05 + vec3( 0.0, 0.05 + side * 0.17 - u * 0.12, 0.0 );
    vec3 n2 = vec3( -rad.z, 0.0, rad.x );
    float m = P.head.w;
    float w1 = clamp( m, 0.0, 1.0 ), w2 = clamp( m - 1.0, 0.0, 1.0 );
    vec3 lp = mix( mix( p0, p1, w1 ), p2, w2 );
    vec3 ln = normalize( mix( mix( n0, n1, w1 ), n2, w2 ) + 1e-4 );
    crowdPos = aP.xyz + toW( lp, hgt, wid, X, F, vis );
    objectNormal = normalize( X * ln.x + vec3( 0.0, ln.y, 0.0 ) + F * ln.z );
    vRest = vec3( u, side, 0.0 );
    vColA = s2l( aShirt.rgb ); vColB = s2l( aSecond.rgb );
    vInfo = vec4( 20.0, 0.0, 1.0, roofLit( aP.w, crowdPos.y, aN.xy ) * uDirScale );
    if ( vis < 0.01 ) crowdPos = aP.xyz;
  }
`;

export const FRAG_HEAD = /* glsl */`
varying vec3 vColA;
varying vec3 vColB;
varying vec3 vRest;
varying vec4 vInfo;
uniform vec3 uRim;
const vec3 J_HEAD = ${v3(J.head)};
const vec3 J_HEADR = ${v3(J.headR)};
`;

// escolhe a cor do pixel: pele/cabelo na cabeça, padrão da camisa, mangas, cachecol
export const FRAG_COLOR = /* glsl */`
  vec3 alb = vColA;
  float part = floor( vInfo.x + 0.5 );
  float style = vInfo.y;
  float rough = 0.6;
  if ( part == 2.0 ) {
    vec3 hd = normalize( ( vRest - J_HEAD ) / J_HEADR );
    float hs = floor( style + 0.5 );
    float thr = hs == 0.0 ? 0.12 : hs == 1.0 ? 0.3 : hs == 2.0 ? 0.05 : hs == 3.0 ? 9.0 : hs == 4.0 ? 0.25 : -0.1;
    float len = hs == 2.0 ? 1.4 : hs == 5.0 ? 0.9 : 0.5;
    float lvl = hd.y + max( -hd.z, 0.0 ) * len - max( hd.z, 0.0 ) * 0.3;
    float hair = smoothstep( thr - 0.06, thr + 0.06, lvl );
    alb = mix( vColA, vColB, hair );
    // olhos e sobrancelhas: um toque de sombra na frente do rosto
    float eyes = smoothstep( 0.9, 0.96, dot( hd, normalize( vec3( 0.36, 0.12, 0.92 ) ) ) )
               + smoothstep( 0.9, 0.96, dot( hd, normalize( vec3( -0.36, 0.12, 0.92 ) ) ) );
    alb *= 1.0 - 0.55 * clamp( eyes, 0.0, 1.0 ) * ( 1.0 - hair );
    rough = mix( 0.55, 0.8, hair );
  } else if ( part == 1.0 ) {
    float ps = floor( style + 0.5 );
    float m = 0.0;
    if ( ps == 1.0 ) m = step( 0.5, fract( vRest.x / 0.085 + 0.25 ) );
    else if ( ps == 2.0 ) m = step( 0.5, fract( vRest.y / 0.1 ) );
    else if ( ps == 3.0 ) m = step( 0.0, vRest.x );
    else if ( ps == 4.0 ) m = step( abs( vRest.x * 0.9 + ( vRest.y - 1.15 ) ), 0.06 );
    else if ( ps == 5.0 ) m = step( 0.8, fract( vRest.x / 0.06 ) );
    else if ( ps == 6.0 ) m = step( abs( vRest.x ), 0.04 ) * step( 0.02, vRest.z );      // jaqueta aberta
    if ( ps == 7.0 || ps == 0.0 ) m = step( 1.43, vRest.y ) * step( 0.5, ps / 7.0 );      // gola
    alb = mix( vColA, vColB, m );
    rough = 0.55;
  } else if ( part >= 4.0 && part < 12.0 ) {
    alb = mix( vColA, vColB, step( vRest.y, style ) );   // abaixo da manga: pele; pés: tênis
    rough = part < 8.0 ? 0.6 : 0.85;
  } else if ( part == 20.0 ) {
    float u = vRest.x;
    alb = mix( vColA, vColB, step( 0.5, fract( u * 5.0 ) ) );
    alb *= 1.0 - 0.35 * ( step( u, 0.04 ) + step( 0.96, u ) );          // franjas
    rough = 0.85;
  } else rough = 0.85;
  diffuseColor.rgb = alb * vInfo.z;
`;
