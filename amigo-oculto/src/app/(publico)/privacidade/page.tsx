import type { Metadata } from "next";
import Link from "next/link";
import { PaginaLegal, emailDeContato } from "@/components/inicio/pagina-legal";

export const metadata: Metadata = {
  title: "Política de privacidade",
  description: "Quais dados o Amigo Oculto guarda, para quê, com quem e como você exerce os seus direitos (LGPD).",
  alternates: { canonical: "/privacidade" },
};

const INDICE = [
  { id: "quem", titulo: "Quem cuida dos seus dados" },
  { id: "dados", titulo: "Quais dados guardamos" },
  { id: "finalidades", titulo: "Para que usamos" },
  { id: "sorteio", titulo: "O sigilo do sorteio" },
  { id: "anonimas", titulo: "Mensagens anônimas" },
  { id: "quem-ve", titulo: "Quem vê o quê no grupo" },
  { id: "operadores", titulo: "Com quem compartilhamos" },
  { id: "cookies", titulo: "Cookies e armazenamento no aparelho" },
  { id: "guarda", titulo: "Por quanto tempo guardamos" },
  { id: "seguranca", titulo: "Segurança" },
  { id: "direitos", titulo: "Seus direitos" },
  { id: "criancas", titulo: "Crianças e adolescentes" },
  { id: "mudancas", titulo: "Mudanças nesta política" },
];

export default function Privacidade() {
  const contato = emailDeContato();
  return (
    <PaginaLegal
      titulo="Política de privacidade"
      atualizado="27 de novembro de 2026"
      indice={INDICE}
      resumo={
        <>
          <strong>Em poucas palavras:</strong> pedimos só o que o amigo oculto precisa para funcionar, não vendemos dados, não mostramos
          anúncios e não usamos rastreadores. O resultado do sorteio fica trancado — <strong>nem quem organiza o grupo consegue ver quem tirou
          quem</strong>. Você pode baixar ou apagar os seus dados quando quiser, em <Link href="/conta" className="font-semibold text-t1 underline underline-offset-4">Minha conta</Link>.
        </>
      }
    >
      <h2 id="quem">1. Quem cuida dos seus dados</h2>
      <p>
        O Amigo Oculto é o responsável (controlador, na linguagem da Lei Geral de Proteção de Dados — Lei 13.709/2018, a LGPD) pelos dados
        tratados neste site. Os grupos são criados por pessoas comuns (os organizadores), que decidem quem convidar e as regras do grupo, mas
        não têm acesso a nada além do que aparece para elas dentro do próprio grupo, como descrito abaixo.
      </p>

      <h2 id="dados">2. Quais dados guardamos</h2>
      <ul>
        <li>
          <strong>Conta:</strong> nome, e-mail e senha (guardada só em forma criptografada pelo serviço de autenticação). Se você entrar com o
          Google, recebemos nome, e-mail e foto da sua conta Google. Quem entra como convidado tem só um nome, até salvar a conta.
        </li>
        <li>
          <strong>Perfil:</strong> apelido, foto e uma frase sobre você, se você quiser preencher.
        </li>
        <li>
          <strong>Participação nos grupos:</strong> de quais grupos você participa, se confirmou presença, se já comprou o presente e se já viu
          o resultado (só o “sim” ou “não”, nunca o resultado em si).
        </li>
        <li>
          <strong>Lista de desejos e preferências:</strong> o que você escrever — itens, links, preços, hobbies, interesses, cores, tamanhos de
          roupa e calçado, o que prefere não ganhar e observações. Tudo opcional.
        </li>
        <li>
          <strong>O que você publica:</strong> mensagens no chat, no mural e nas mensagens anônimas, respostas de enquetes e jogos, cartões,
          cápsulas do tempo e fotos do álbum.
        </li>
        <li>
          <strong>Notificações:</strong> os avisos do app e, se você ativar, a inscrição para notificações no navegador (um endereço técnico
          gerado pelo navegador) e o envio de e-mails.
        </li>
        <li>
          <strong>Dados técnicos:</strong> como qualquer site, os servidores registram endereço IP, data e hora e tipo de navegador, para manter
          o serviço funcionando e seguro.
        </li>
      </ul>
      <p>
        Não pedimos CPF, endereço, telefone nem dados de pagamento. Por favor, não escreva dados sensíveis (saúde, religião, documentos) na lista
        de desejos ou nas mensagens.
      </p>

      <h2 id="finalidades">3. Para que usamos</h2>
      <ul>
        <li>Criar e manter a sua conta e os seus grupos, fazer o sorteio e mostrar a cada pessoa o próprio resultado (execução do serviço que você pediu).</li>
        <li>Mostrar a sua lista de desejos e as suas preferências para quem participa dos mesmos grupos, e calcular ideias de presente para quem tirou você.</li>
        <li>Enviar os avisos do grupo (sorteio feito, lembretes, mensagens), pelo app e, se você ativar, por e-mail e notificação no navegador.</li>
        <li>Proteger o serviço: limitar abusos, investigar denúncias e cumprir obrigações legais (legítimo interesse e obrigação legal).</li>
      </ul>
      <p>As ideias de presente são calculadas por regras simples a partir do que a pessoa escreveu; nada é enviado para serviços de inteligência artificial.</p>

      <h2 id="sorteio">4. O sigilo do sorteio</h2>
      <p>
        O sorteio é feito no servidor, com aleatoriedade criptográfica. O resultado é gravado numa tabela que <strong>nenhuma pessoa consegue ler
        diretamente</strong> — nem participantes, nem organizadores. A única forma de ver um resultado é pedir o <em>seu próprio</em>, depois de
        entrar na sua conta. O organizador vê apenas números, como “8 de 10 pessoas já viram o resultado”.
      </p>
      <p>
        Na revelação ao vivo (o telão), o nome de quem você tirou só aparece se você revelar pelo seu celular ou se você autorizar o organizador a
        revelar por você.
      </p>

      <h2 id="anonimas">5. Mensagens anônimas</h2>
      <p>
        Nas mensagens anônimas, quem recebe não vê quem escreveu. Para entregar a mensagem, o sistema guarda a ligação com o par do sorteio, mas
        essa ligação não aparece para ninguém. Se uma mensagem for denunciada, o organizador do grupo vê apenas o <strong>texto denunciado</strong> —
        nunca quem escreveu — e pode removê-lo ou impedir novas mensagens daquele remetente, sem descobrir quem é.
      </p>

      <h2 id="quem-ve">6. Quem vê o quê no grupo</h2>
      <ul>
        <li>Participantes aprovados do mesmo grupo veem o seu nome, apelido e foto, a sua lista de desejos e as suas preferências.</li>
        <li>O organizador vê, além disso, os pedidos para entrar no grupo e as restrições do sorteio (por exemplo, “casais não se tiram”).</li>
        <li>Chat, mural, enquetes e álbum são vistos por quem participa do grupo. As fotos do álbum ficam num espaço privado do grupo.</li>
        <li>Grupos marcados como públicos aparecem na lista de grupos públicos (nome, descrição e tema), mas o conteúdo continua só para quem participa.</li>
      </ul>

      <h2 id="operadores">7. Com quem compartilhamos</h2>
      <p>Não vendemos nem alugamos dados. Usamos fornecedores (operadores, na LGPD) que tratam os dados só para prestar o serviço para nós:</p>
      <ul>
        <li>
          <strong>Supabase</strong> — banco de dados, autenticação e armazenamento das fotos.
        </li>
        <li>
          <strong>Hospedagem do site</strong> — onde o aplicativo roda e entrega as páginas.
        </li>
        <li>
          <strong>Envio de e-mails</strong> — o serviço de e-mail usado para os avisos, quando ativado.
        </li>
        <li>
          <strong>Notificações do navegador</strong> — o serviço de push do seu próprio navegador (Google, Apple ou Mozilla), se você ativar.
        </li>
        <li>
          <strong>Google</strong> — só se você escolher entrar com a sua conta Google.
        </li>
      </ul>
      <p>
        Alguns desses fornecedores podem guardar dados em servidores fora do Brasil. Nesses casos, a transferência segue o que a LGPD permite
        (art. 33), com contratos que exigem proteção equivalente. Também podemos fornecer dados quando a lei ou uma ordem judicial exigir.
      </p>

      <h2 id="cookies">8. Cookies e armazenamento no aparelho</h2>
      <p>
        Usamos apenas cookies <strong>necessários</strong>: os da sessão, que mantêm você conectado. No seu aparelho também guardamos preferências
        simples, como o modo claro ou escuro. Não há cookies de publicidade nem de análise de terceiros. A demonstração da página inicial roda
        inteira no seu navegador e não envia nem salva nada.
      </p>

      <h2 id="guarda">9. Por quanto tempo guardamos</h2>
      <ul>
        <li>Os dados da conta ficam enquanto a conta existir. Ao excluir a conta, apagamos o perfil, a lista de desejos, as preferências, as participações nos grupos e as publicações ligadas a elas. E-mails de aviso já enviados ficam na caixa de quem os recebeu.</li>
        <li>Os dados de um grupo ficam até o organizador excluir o grupo.</li>
        <li>Registros técnicos e cópias de segurança dos fornecedores são mantidos por um período limitado e depois descartados.</li>
      </ul>

      <h2 id="seguranca">10. Segurança</h2>
      <p>
        Conexão sempre criptografada (HTTPS), regras de acesso no próprio banco de dados (cada consulta só devolve o que aquela pessoa pode ver),
        senhas guardadas de forma criptografada e limite de ações para evitar abusos. Nenhum sistema é infalível: se acontecer um incidente que
        possa trazer risco a você, avisaremos e comunicaremos a Autoridade Nacional de Proteção de Dados (ANPD), como manda a lei.
      </p>

      <h2 id="direitos">11. Seus direitos</h2>
      <p>Pela LGPD (art. 18), você pode:</p>
      <ul>
        <li>
          <strong>Confirmar e acessar</strong> os seus dados e <strong>levá-los com você</strong>: em{" "}
          <Link href="/conta">Minha conta</Link>, “Exportar meus dados” baixa um arquivo com tudo o que a sua conta guarda.
        </li>
        <li>
          <strong>Corrigir</strong> dados: edite o perfil, a lista de desejos e as preferências a qualquer momento.
        </li>
        <li>
          <strong>Excluir</strong> a conta e os dados: em <Link href="/conta">Minha conta</Link>. Se você organiza algum grupo, arquive ou exclua o
          grupo antes.
        </li>
        <li>
          <strong>Revogar consentimentos</strong>, como e-mails e notificações, nas configurações da conta ou do navegador.
        </li>
        <li>
          <strong>Pedir informações</strong> sobre com quem os dados são compartilhados e <strong>reclamar</strong> à ANPD (gov.br/anpd).
        </li>
      </ul>
      <p>
        {contato ? (
          <>
            Para qualquer outro pedido ou dúvida, escreva para <a href={`mailto:${contato}`}>{contato}</a>. Respondemos no prazo da lei.
          </>
        ) : (
          <>Para qualquer outro pedido ou dúvida sobre privacidade, fale com quem administra este site pelo canal de contato informado por ele.</>
        )}
      </p>

      <h2 id="criancas">12. Crianças e adolescentes</h2>
      <p>
        O Amigo Oculto pode ser usado em famílias e escolas. Crianças e adolescentes devem usar com a participação e o consentimento de um dos
        pais ou responsável, que pode pedir a exclusão dos dados a qualquer momento. Não usamos dados de crianças para nada além do próprio amigo
        oculto.
      </p>

      <h2 id="mudancas">13. Mudanças nesta política</h2>
      <p>
        Se esta política mudar de forma importante, avisaremos no aplicativo antes de a mudança valer. A data no topo mostra a última atualização.
        Veja também os <Link href="/termos">Termos de uso</Link>.
      </p>
    </PaginaLegal>
  );
}
