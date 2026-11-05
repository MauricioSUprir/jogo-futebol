/* ===== perguntas-banco.js — perguntas prontas para os duelos =====
   Usadas no plano grátis e quando a IA não responde. Nível ensino fundamental II
   e médio. correta = índice (0–3) da opção certa.                              */
const P = (materia, enunciado, opcoes, correta, explicacao) => ({ materia, enunciado, opcoes, correta, explicacao });

export const BANCO = [
  // Matemática
  P('Matemática', 'Quanto é 15% de 200?', ['15', '20', '30', '35'], 2, '15% = 0,15; 0,15 × 200 = 30.'),
  P('Matemática', 'Qual é a raiz quadrada de 144?', ['10', '12', '14', '16'], 1, '12 × 12 = 144.'),
  P('Matemática', 'Se 2x + 6 = 20, quanto vale x?', ['5', '6', '7', '8'], 2, '2x = 14, então x = 7.'),
  P('Matemática', 'Quantos graus tem a soma dos ângulos internos de um triângulo?', ['90°', '180°', '270°', '360°'], 1, 'Em todo triângulo a soma é 180°.'),
  P('Matemática', 'Qual é a área de um retângulo de 8 cm por 5 cm?', ['13 cm²', '26 cm²', '40 cm²', '45 cm²'], 2, 'Área = base × altura = 8 × 5 = 40 cm².'),
  P('Matemática', 'Quanto é 2³ + 3²?', ['13', '15', '17', '19'], 2, '2³ = 8 e 3² = 9; 8 + 9 = 17.'),
  P('Matemática', 'Qual destes números é primo?', ['21', '27', '29', '33'], 2, '29 só é divisível por 1 e por ele mesmo.'),
  P('Matemática', 'A fração 3/4 é igual a quanto em porcentagem?', ['34%', '60%', '75%', '80%'], 2, '3 ÷ 4 = 0,75 = 75%.'),
  // Português
  P('Português', 'Qual palavra está escrita corretamente?', ['Excessão', 'Exceção', 'Esseção', 'Excesão'], 1, 'O certo é "exceção", com x e ç.'),
  P('Português', 'Em "Os alunos estudaram muito", qual é o sujeito?', ['Os alunos', 'estudaram', 'muito', 'Sujeito oculto'], 0, 'Quem estudou? Os alunos.'),
  P('Português', 'Qual é o plural de "cidadão"?', ['Cidadões', 'Cidadães', 'Cidadãos', 'Cidadãoes'], 2, 'O plural correto é "cidadãos".'),
  P('Português', 'Qual destas palavras é um advérbio?', ['Rápido (em "carro rápido")', 'Ontem', 'Bonita', 'Correr'], 1, '"Ontem" indica tempo: é advérbio.'),
  P('Português', 'Que figura de linguagem há em "Ela é uma flor"?', ['Hipérbole', 'Metáfora', 'Ironia', 'Onomatopeia'], 1, 'Comparação sem "como": metáfora.'),
  P('Português', 'Qual frase usa a crase corretamente?', ['Vou à escola.', 'Vou à pé.', 'Comecei à estudar.', 'Falei à ele.'], 0, 'Antes de palavra feminina regida por "a": "à escola".'),
  P('Português', 'Quem escreveu "Dom Casmurro"?', ['José de Alencar', 'Machado de Assis', 'Monteiro Lobato', 'Clarice Lispector'], 1, 'Machado de Assis publicou o livro em 1899.'),
  P('Português', 'Qual é o antônimo de "generoso"?', ['Bondoso', 'Avarento', 'Gentil', 'Educado'], 1, 'Avarento é quem não gosta de gastar ou dividir.'),
  // Ciências / Biologia
  P('Ciências', 'Qual organela faz a fotossíntese nas plantas?', ['Mitocôndria', 'Cloroplasto', 'Ribossomo', 'Núcleo'], 1, 'O cloroplasto tem a clorofila que capta a luz.'),
  P('Ciências', 'Qual gás as plantas liberam na fotossíntese?', ['Gás carbônico', 'Nitrogênio', 'Oxigênio', 'Hidrogênio'], 2, 'Elas absorvem CO₂ e liberam O₂.'),
  P('Ciências', 'Qual é o maior órgão do corpo humano?', ['Fígado', 'Pele', 'Coração', 'Intestino'], 1, 'A pele é o maior órgão do corpo.'),
  P('Ciências', 'O DNA fica principalmente em qual parte da célula?', ['Membrana', 'Citoplasma', 'Núcleo', 'Parede celular'], 2, 'Nas células eucariontes o DNA fica no núcleo.'),
  P('Ciências', 'A água ferve a quantos graus Celsius ao nível do mar?', ['90 °C', '100 °C', '110 °C', '120 °C'], 1, 'Ao nível do mar, a água ferve a 100 °C.'),
  P('Ciências', 'Qual planeta é conhecido como "planeta vermelho"?', ['Vênus', 'Júpiter', 'Marte', 'Saturno'], 2, 'O óxido de ferro deixa Marte avermelhado.'),
  P('Ciências', 'Qual é a fórmula química da água?', ['CO₂', 'H₂O', 'O₂', 'NaCl'], 1, 'Dois hidrogênios e um oxigênio: H₂O.'),
  P('Ciências', 'Os seres que produzem o próprio alimento são chamados de:', ['Consumidores', 'Decompositores', 'Produtores', 'Parasitas'], 2, 'Plantas e algas são produtores (autótrofos).'),
  // História
  P('História', 'Em que ano o Brasil declarou a independência?', ['1500', '1789', '1822', '1889'], 2, 'Em 7 de setembro de 1822.'),
  P('História', 'Quem assinou a Lei Áurea, que aboliu a escravidão no Brasil?', ['Dom Pedro I', 'Princesa Isabel', 'Getúlio Vargas', 'Tiradentes'], 1, 'A Princesa Isabel assinou em 13 de maio de 1888.'),
  P('História', 'Em que ano foi proclamada a República no Brasil?', ['1822', '1888', '1889', '1930'], 2, 'Em 15 de novembro de 1889.'),
  P('História', 'Qual civilização construiu as pirâmides de Gizé?', ['Romanos', 'Gregos', 'Egípcios', 'Maias'], 2, 'Foram construídas pelos antigos egípcios.'),
  P('História', 'A Revolução Francesa começou em qual ano?', ['1492', '1789', '1815', '1914'], 1, 'Com a queda da Bastilha, em 1789.'),
  P('História', 'Qual guerra aconteceu entre 1939 e 1945?', ['Primeira Guerra Mundial', 'Guerra Fria', 'Segunda Guerra Mundial', 'Guerra do Paraguai'], 2, 'A Segunda Guerra Mundial foi de 1939 a 1945.'),
  P('História', 'Quem chegou ao Brasil em 1500, liderando a frota portuguesa?', ['Vasco da Gama', 'Pedro Álvares Cabral', 'Cristóvão Colombo', 'Fernão de Magalhães'], 1, 'A frota de Pedro Álvares Cabral chegou em abril de 1500.'),
  P('História', 'O período da Ditadura Militar no Brasil começou em:', ['1930', '1945', '1964', '1985'], 2, 'Começou com o golpe de 1964 e terminou em 1985.'),
  // Geografia
  P('Geografia', 'Qual é a capital do Brasil?', ['Rio de Janeiro', 'São Paulo', 'Brasília', 'Salvador'], 2, 'Brasília é a capital desde 1960.'),
  P('Geografia', 'Qual é o maior bioma do Brasil?', ['Cerrado', 'Amazônia', 'Caatinga', 'Pampa'], 1, 'A Amazônia ocupa quase metade do território.'),
  P('Geografia', 'Qual é o maior oceano do planeta?', ['Atlântico', 'Índico', 'Pacífico', 'Ártico'], 2, 'O Pacífico é o maior e o mais profundo.'),
  P('Geografia', 'Quantas regiões o IBGE usa para dividir o Brasil?', ['4', '5', '6', '7'], 1, 'Norte, Nordeste, Centro-Oeste, Sudeste e Sul.'),
  P('Geografia', 'Qual linha imaginária divide a Terra em hemisférios Norte e Sul?', ['Trópico de Câncer', 'Meridiano de Greenwich', 'Linha do Equador', 'Círculo Polar'], 2, 'A Linha do Equador.'),
  P('Geografia', 'Em qual continente fica o Egito?', ['Ásia', 'África', 'Europa', 'Oceania'], 1, 'O Egito fica no nordeste da África.'),
  P('Geografia', 'Qual estado brasileiro tem a maior área?', ['Pará', 'Mato Grosso', 'Amazonas', 'Minas Gerais'], 2, 'O Amazonas é o maior estado em área.'),
  P('Geografia', 'O que mede a latitude?', ['A distância ao Equador', 'A distância a Greenwich', 'A altitude', 'O fuso horário'], 0, 'Latitude é a distância em graus até a Linha do Equador.'),
  // Inglês
  P('Inglês', 'Como se diz "biblioteca" em inglês?', ['Bookstore', 'Library', 'Librery', 'Bookhouse'], 1, '"Library" é biblioteca; "bookstore" é livraria.'),
  P('Inglês', 'Qual é o passado de "go"?', ['Goed', 'Gone', 'Went', 'Going'], 2, '"Go" é irregular: go, went, gone.'),
  P('Inglês', 'Complete: "She ___ a student."', ['am', 'is', 'are', 'be'], 1, 'Com she/he/it usamos "is".'),
  P('Inglês', 'O que significa "actually"?', ['Atualmente', 'Na verdade', 'Ativamente', 'Antigamente'], 1, '"Actually" = na verdade (falso cognato).'),
  P('Inglês', 'Qual é o plural de "child"?', ['Childs', 'Childes', 'Children', 'Childrens'], 2, 'É irregular: child → children.'),
  P('Inglês', 'Como se diz "quinta-feira" em inglês?', ['Tuesday', 'Thursday', 'Wednesday', 'Saturday'], 1, 'Thursday é quinta-feira.'),
  P('Inglês', 'Complete: "I have lived here ___ 2020."', ['for', 'since', 'during', 'at'], 1, '"Since" + ponto no tempo (2020).'),
  P('Inglês', 'O que significa "pretend"?', ['Pretender', 'Fingir', 'Prender', 'Prometer'], 1, '"Pretend" = fingir (falso cognato).'),
];

export const MATERIAS_BANCO = [...new Set(BANCO.map((q) => q.materia))];

/** Sorteia n perguntas (de uma matéria, ou misturadas). As opções vêm embaralhadas. */
export function sortearPerguntas(n = 5, materia = '', sorte = Math.random) {
  let base = materia ? BANCO.filter((q) => q.materia === materia) : BANCO;
  if (base.length < n) base = BANCO;
  const copia = [...base];
  for (let i = copia.length - 1; i > 0; i--) { const j = Math.floor(sorte() * (i + 1)); [copia[i], copia[j]] = [copia[j], copia[i]]; }
  return copia.slice(0, n).map((q) => embaralharOpcoes(q, sorte));
}

export function embaralharOpcoes(q, sorte = Math.random) {
  const ordem = q.opcoes.map((_, i) => i);
  for (let i = ordem.length - 1; i > 0; i--) { const j = Math.floor(sorte() * (i + 1)); [ordem[i], ordem[j]] = [ordem[j], ordem[i]]; }
  return { ...q, opcoes: ordem.map((i) => q.opcoes[i]), correta: ordem.indexOf(q.correta) };
}
