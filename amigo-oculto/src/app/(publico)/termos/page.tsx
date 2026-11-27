import type { Metadata } from "next";
import Link from "next/link";
import { PaginaLegal, emailDeContato } from "@/components/inicio/pagina-legal";

export const metadata: Metadata = {
  title: "Termos de uso",
  description: "As regras para usar o Amigo Oculto: conta, grupos, conduta, conteúdo, moderação e responsabilidades.",
  alternates: { canonical: "/termos" },
};

const INDICE = [
  { id: "aceite", titulo: "Aceite" },
  { id: "servico", titulo: "O que é o serviço" },
  { id: "conta", titulo: "Sua conta" },
  { id: "organizadores", titulo: "Organizadores e grupos" },
  { id: "conduta", titulo: "Conduta" },
  { id: "conteudo", titulo: "O seu conteúdo" },
  { id: "moderacao", titulo: "Denúncias e moderação" },
  { id: "presentes", titulo: "Presentes, valores e encontros" },
  { id: "disponibilidade", titulo: "Disponibilidade e mudanças" },
  { id: "responsabilidade", titulo: "Responsabilidades" },
  { id: "encerramento", titulo: "Encerramento" },
  { id: "lei", titulo: "Lei aplicável e contato" },
];

export default function Termos() {
  const contato = emailDeContato();
  return (
    <PaginaLegal
      titulo="Termos de uso"
      atualizado="27 de novembro de 2026"
      indice={INDICE}
      resumo={
        <>
          <strong>Em poucas palavras:</strong> use o Amigo Oculto para organizar trocas de presentes com respeito. Seja gentil nas mensagens
          (inclusive nas anônimas), não publique o que não é seu nem o que possa machucar alguém, e lembre que a compra e a entrega dos presentes
          acontecem fora do app, entre vocês. Como tratamos os seus dados está na{" "}
          <Link href="/privacidade" className="font-semibold text-t1 underline underline-offset-4">política de privacidade</Link>.
        </>
      }
    >
      <h2 id="aceite">1. Aceite</h2>
      <p>
        Ao criar uma conta, entrar como convidado ou participar de um grupo, você concorda com estes termos e com a{" "}
        <Link href="/privacidade">política de privacidade</Link>. Se não concordar, não use o serviço.
      </p>

      <h2 id="servico">2. O que é o serviço</h2>
      <p>
        O Amigo Oculto é uma plataforma para criar grupos de amigo oculto (também chamado de amigo secreto): convites, sorteio, lista de desejos,
        mensagens anônimas, jogos, revelação (no celular ou ao vivo) e álbum de fotos. O app não vende produtos, não intermedeia pagamentos e não
        entrega presentes.
      </p>

      <h2 id="conta">3. Sua conta</h2>
      <ul>
        <li>Use informações verdadeiras e um nome pelo qual as pessoas do grupo reconheçam você.</li>
        <li>Guarde a sua senha. Você é responsável pelo que for feito com a sua conta; se suspeitar de uso indevido, troque a senha.</li>
        <li>Quem entra como convidado pode perder o acesso ao trocar de aparelho ou limpar o navegador, até salvar a conta com e-mail e senha.</li>
        <li>Menores de idade devem usar com a participação e o consentimento de um dos pais ou responsável.</li>
      </ul>

      <h2 id="organizadores">4. Organizadores e grupos</h2>
      <ul>
        <li>Quem cria o grupo é o organizador: define as regras, o valor, as datas, aprova quem entra, cria restrições e faz (ou agenda) o sorteio.</li>
        <li>O organizador pode nomear outros organizadores, remover participantes antes do sorteio, refazer o sorteio enquanto a revelação ao vivo não começou, moderar o conteúdo e encerrar, arquivar ou excluir o grupo.</li>
        <li>O organizador não vê quem tirou quem nem quem escreveu mensagens anônimas — e não deve tentar descobrir por outros meios.</li>
        <li>Convide só pessoas que querem participar e combine com elas as regras do grupo.</li>
      </ul>

      <h2 id="conduta">5. Conduta</h2>
      <p>Não é permitido usar o Amigo Oculto para:</p>
      <ul>
        <li>assediar, ameaçar, humilhar, discriminar ou expor outras pessoas — também nas mensagens anônimas;</li>
        <li>publicar conteúdo sexual, violento, ilegal, ou que viole direitos de imagem, autorais ou de privacidade;</li>
        <li>mandar spam, golpes, correntes ou links maliciosos;</li>
        <li>tentar descobrir o resultado do sorteio de outras pessoas, burlar a segurança, acessar contas alheias ou sobrecarregar o serviço;</li>
        <li>se passar por outra pessoa.</li>
      </ul>
      <p>Brincadeira boa é a que todo mundo acha graça. Na dúvida, não mande.</p>

      <h2 id="conteudo">6. O seu conteúdo</h2>
      <p>
        O que você escreve e as fotos que você envia continuam sendo seus. Você nos dá permissão para guardar, mostrar e adaptar esse conteúdo
        (por exemplo, reduzir o tamanho das fotos) só para fazer o serviço funcionar para o seu grupo. Envie apenas o que você tem direito de
        compartilhar, e lembre que as pessoas do grupo podem ver, copiar ou fotografar a tela.
      </p>

      <h2 id="moderacao">7. Denúncias e moderação</h2>
      <ul>
        <li>Qualquer participante pode denunciar mensagens do chat, do mural, fotos do álbum e mensagens anônimas que recebeu.</li>
        <li>O organizador do grupo analisa as denúncias e pode arquivar, apagar o conteúdo ou silenciar quem publicou por alguns dias. Nas mensagens anônimas, ele faz isso sem saber quem escreveu.</li>
        <li>Também podemos remover conteúdo, suspender ou encerrar contas que violem estes termos ou a lei, e colaborar com autoridades quando houver obrigação legal.</li>
      </ul>

      <h2 id="presentes">8. Presentes, valores e encontros</h2>
      <p>
        O valor sugerido, a compra, a entrega e o encontro são combinados entre as pessoas do grupo. Links e preços da lista de desejos são
        colocados pelos próprios participantes e as ideias de presente são apenas sugestões: confira loja, preço, tamanho e disponibilidade antes
        de comprar. Não respondemos por produtos, lojas, entregas ou pelo encontro em si.
      </p>

      <h2 id="disponibilidade">9. Disponibilidade e mudanças</h2>
      <p>
        Trabalhamos para o serviço ficar sempre no ar, mas podem acontecer falhas, manutenções e mudanças de funcionalidades. Se estes termos
        mudarem de forma importante, avisaremos no aplicativo antes de valer. Continuar usando depois do aviso significa concordar com a nova versão.
      </p>

      <h2 id="responsabilidade">10. Responsabilidades</h2>
      <p>
        Cada pessoa responde pelo que publica e pelo que faz no grupo. Respondemos pelo funcionamento do serviço nos termos da lei, incluindo o
        Código de Defesa do Consumidor e o Marco Civil da Internet, sem prejuízo dos direitos que a lei garante a você.
      </p>

      <h2 id="encerramento">11. Encerramento</h2>
      <p>
        Você pode sair de um grupo (exceto quem o criou) ou excluir a sua conta quando quiser, em <Link href="/conta">Minha conta</Link>. Contas
        que violarem estes termos podem ser suspensas ou encerradas.
      </p>

      <h2 id="lei">12. Lei aplicável e contato</h2>
      <p>
        Estes termos seguem as leis brasileiras. Você pode buscar seus direitos no foro do seu domicílio.{" "}
        {contato ? (
          <>
            Dúvidas ou pedidos: <a href={`mailto:${contato}`}>{contato}</a>.
          </>
        ) : (
          <>Dúvidas ou pedidos: fale com quem administra este site pelo canal de contato informado por ele.</>
        )}
      </p>
    </PaginaLegal>
  );
}
