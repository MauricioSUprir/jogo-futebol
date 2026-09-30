// Narração em texto (PT-BR). Função pura: recebe o evento e um RNG, devolve a frase.

const T = {
  goal: [
    'GOOOL! {p} balança a rede para o {team}!',
    'É GOL! {p} não perdoa e marca para o {team}!',
    'GOL do {team}! {p} manda para o fundo da rede!',
    'Golaço de {p}! O {team} comemora!',
  ],
  goalAssist: [' Assistência de {a}.', ' Passe perfeito de {a}.', ' {a} serviu na medida.'],
  goalHeader: ['GOL DE CABEÇA! {p} sobe mais que todo mundo e marca para o {team}!', 'De cabeça! {p} testa firme e é gol do {team}!'],
  goalPen: ['GOL! {p} bate o pênalti com categoria e marca para o {team}!', 'Pênalti convertido! {p} desloca o goleiro.'],
  goalFK: ['QUE COBRANÇA! {p} acerta a falta no ângulo! Gol do {team}!'],
  ownGoal: ['Gol contra! {p} desvia para o próprio gol. Sorte do {team}.'],
  save: ['Defesa de {k}! {p} bateu firme, mas o goleiro estava lá.', '{p} finaliza e {k} espalma!', 'Grande defesa de {k} no chute de {p}!', '{k} segura firme a finalização de {p}.'],
  savePen: ['DEFENDEU! {k} pega o pênalti de {p}!'],
  wide: ['{p} arrisca, mas a bola sai pela linha de fundo.', 'Por cima! {p} isola a finalização.', '{p} tenta, e a bola passa rente à trave.', 'Chute de {p} sem direção.'],
  post: ['NA TRAVE! {p} quase marca para o {team}!', 'Bola no poste! Que susto: {p} por centímetros.'],
  blocked: ['Chute de {p} travado pela defesa.', '{p} finaliza, mas a zaga bloqueia.'],
  bigMiss: ['Inacreditável! {p} perde um gol feito!', 'Como é que não entrou?! {p} desperdiça a chance clara.'],
  corner: ['Escanteio para o {team}.', 'Vai ter escanteio para o {team}.'],
  foul: ['Falta de {p} em {v}.', '{p} chega atrasado e derruba {v}.', 'Falta cometida por {p}.'],
  yellow: ['Cartão amarelo para {p} ({team}).', '{p} recebe o amarelo.'],
  secondYellow: ['Segundo amarelo! {p} está expulso!'],
  red: ['CARTÃO VERMELHO! {p} é expulso direto!'],
  penalty: ['PÊNALTI! {v} é derrubado dentro da área por {p}!'],
  offside: ['Impedimento de {p}. O assistente levanta a bandeira.', 'Bandeira erguida: {p} estava impedido.'],
  sub: ['Substituição no {team}: sai {out}, entra {in}.'],
  kickoff: ['Rola a bola! Começa a partida: {home} x {away}.'],
  secondHalf: ['Começa o segundo tempo.'],
  halftime: ['Fim do primeiro tempo: {home} {sh} x {sa} {away}.'],
  fulltime: ['Fim de jogo! {home} {sh} x {sa} {away}.'],
  added: ['Mais {n} minutos de acréscimo.'],
  tactic: ['{team} muda a postura: {what}.'],
  formation: ['{team} muda o desenho para o {what}.'],
};

export function commentary(type, vars, rng) {
  const list = T[type];
  if (!list) return '';
  const s = list[Math.floor(rng.next() * list.length)];
  return s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ''));
}
