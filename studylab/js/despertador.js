/* ===== despertador.js — as contas do despertador (sem tela, testável em Node) =====
   Cada alarme: { id, hora: 'HH:MM', dias: [0..6] (0 = domingo; vazio = uma vez só),
   rotulo, ativo, ultimo: 'AAAA-MM-DDTHH:MM' do último toque, sonecaAte: idem }.  */

export const DIAS_CURTOS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
export const SONECA_MIN = 5;

const dois = (n) => String(n).padStart(2, '0');

/** 'AAAA-MM-DDTHH:MM' no horário do aparelho. */
export function chaveMinuto(d) {
  return `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}T${dois(d.getHours())}:${dois(d.getMinutes())}`;
}

export function horaValida(hora) {
  const m = /^(\d{2}):(\d{2})$/.exec(String(hora || ''));
  return !!m && +m[1] < 24 && +m[2] < 60;
}

/** Os alarmes que tocam neste minuto (e que ainda não tocaram nele). */
export function devemTocar(lista, agora) {
  const chave = chaveMinuto(agora);
  const hhmm = chave.slice(11);
  const dia = agora.getDay();
  return (lista || []).filter((a) => {
    if (!a || !a.ativo || a.ultimo === chave) return false;
    if (a.sonecaAte && a.sonecaAte === chave) return true;
    if (a.hora !== hhmm) return false;
    return !a.dias?.length || a.dias.includes(dia);
  });
}

/** O que muda no alarme quando ele toca: grava o minuto e desliga o de uma vez só. */
export function aposTocar(a, agora) {
  const chave = chaveMinuto(agora);
  const eraSoneca = a.sonecaAte === chave;
  return {
    ...a,
    ultimo: chave,
    sonecaAte: null,
    // o de "uma vez só" desliga depois de tocar — a não ser que o aluno peça soneca
    ativo: a.dias?.length || eraSoneca ? a.ativo : false,
  };
}

/** Soneca: toca de novo daqui a N minutos (e religa o de uma vez só). */
export function soneca(a, agora, minutos = SONECA_MIN) {
  const depois = new Date(agora.getTime() + minutos * 60000);
  return { ...a, ativo: true, sonecaAte: chaveMinuto(depois) };
}

/** Quando ele toca de novo (Date) — null se desligado ou sem dia possível. */
export function proximoToque(a, agora) {
  if (!a?.ativo || !horaValida(a.hora)) return null;
  const [hh, mm] = a.hora.split(':').map(Number);
  const candidatos = [];
  if (a.sonecaAte) {
    const [d, t] = a.sonecaAte.split('T');
    const [Y, M, D] = d.split('-').map(Number);
    const [H, Mi] = t.split(':').map(Number);
    const s = new Date(Y, M - 1, D, H, Mi);
    if (s > agora) candidatos.push(s);
  }
  for (let i = 0; i < 8; i++) {
    const c = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() + i, hh, mm);
    if (c <= agora) continue;
    if (a.dias?.length && !a.dias.includes(c.getDay())) continue;
    if (chaveMinuto(c) === a.ultimo) continue;
    candidatos.push(c);
    break;
  }
  candidatos.sort((x, y) => x - y);
  return candidatos[0] || null;
}

/** "em 7 h 20 min" / "em 45 min" / "em menos de 1 min". */
export function faltaTexto(alvo, agora) {
  if (!alvo) return '';
  const min = Math.floor((alvo - agora) / 60000);
  if (min < 1) return 'em menos de 1 min';
  const d = Math.floor(min / 1440), h = Math.floor((min % 1440) / 60), m = min % 60;
  if (d) return `em ${d} dia${d > 1 ? 's' : ''}${h ? ` e ${h} h` : ''}`;
  return h ? `em ${h} h${m ? ` ${m} min` : ''}` : `em ${m} min`;
}

export function descreverDias(dias) {
  if (!dias?.length) return 'Uma vez';
  const s = [...dias].sort().join(',');
  if (s === '0,1,2,3,4,5,6') return 'Todo dia';
  if (s === '1,2,3,4,5') return 'Dias de semana';
  if (s === '0,6') return 'Fim de semana';
  return [...dias].sort().map((d) => DIAS_CURTOS[d]).join(', ');
}
