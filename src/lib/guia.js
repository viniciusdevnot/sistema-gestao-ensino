/* Conteúdo do Guia do sistema (onboarding). Para acrescentar uma função nova, inclua um capítulo
   e aumente GUIA_VERSAO: quem já viu o guia recebe o aviso de capítulo novo. */
export const GUIA_VERSAO = 5;
const gN = n => `<i class="gn">${n}</i>`;
const gDica = t => `<div class="g-dica"><b>Dica</b>${t}</div>`;
const gAtencao = t => `<div class="g-dica atencao"><b>Atenção</b>${t}</div>`;
const gLista = itens => '<ol class="g-passos">' + itens.map(([n, t]) => `<li>${n ? gN(n) : '<i class="gn-pt"></i>'}<div>${t}</div></li>`).join('') + '</ol>';

export const GUIA_TODOS = [
  {cap: 'Primeiros passos', icone: '🚀', passos: [
    {t: 'Bem-vindo ao Sistema de Gestão de Ensino', img: ['05_tela_principal'], html: `
      <p>O sistema funciona <b>pela internet</b>: abra o endereço do sistema no navegador do computador ou do celular e entre com o seu usuário. Tudo fica guardado num <b>banco de dados on-line</b> e é salvo sozinho.</p>
      <p>Este guia mostra, passo a passo, como usar <b>todas as funções</b> do sistema, com as telas reais marcadas com números. Cada número da imagem é explicado no texto.</p>
      ${gLista([
        ['', 'Use <b>Próximo</b> e <b>Anterior</b> (ou as setas ← → do teclado) para avançar.'],
        ['', 'À esquerda ficam os <b>capítulos</b>: clique em qualquer um para ir direto ao assunto.'],
        ['', 'Clique numa imagem para vê-la <b>ampliada</b>.'],
        ['', 'Você pode fechar o guia a qualquer momento e reabrir depois pelo menu, em <b>Guia do sistema</b>.']])}
      ${gDica('O guia aparece sozinho só no primeiro acesso de cada perfil. Depois, abra quando quiser pelo menu.')}`},
    {t: 'Entrar com usuário e senha', img: ['02_perfis'], html: `
      <p>Cada pessoa tem o seu próprio <b>usuário e senha</b>. Ninguém entra no perfil de outra pessoa.</p>
      ${gLista([
        [1, '<b>Usuário</b> — o nome de acesso que você criou (ex.: <i>sgt.silva</i>).'],
        [2, '<b>Senha</b> — a sua senha pessoal.'],
        [3, '<b>Salvar meu usuário neste computador</b> — marcado, nas próximas vezes o sistema já mostra o seu nome e pede <b>só a senha</b>. Desmarque em computador compartilhado.'],
        [4, 'Clique em <b>Entrar</b> (ou tecle Enter).'],
        [5, '<b>Criar usuário</b> — se é a primeira vez que você usa o sistema.'],
        [6, '<b>Esqueci minha senha</b> — envia um pedido ao administrador (veja o passo “Esqueci a senha”).']])}
      ${gDica('Você entra de <b>qualquer computador ou celular</b>, com o mesmo usuário e senha. A senha é guardada embaralhada (criptografada), nunca em texto puro.')}`},
    {t: 'Criar o seu usuário', img: ['03_criar_perfil'], html: `
      ${gLista([
        [1, '<b>Escolher foto</b> (opcional) — a foto aparece no menu.'],
        [2, '<b>Nome de guerra / nome</b> — é assim que você aparece no sistema e nos registros.'],
        [3, '<b>Posto / graduação</b> — por exemplo, <i>2º Sgt PM</i>.'],
        [4, '<b>Setor / função</b> — por exemplo, <i>Seção de Ensino</i>.'],
        [5, '<b>Oficial ou Praça</b> — marque o seu círculo. Oficiais veem também o menu <b>Procedimentos</b>. Depois de criado, só o administrador pode mudar.'],
        [6, '<b>Usuário</b> — o nome que você vai digitar para entrar: sem espaços e sem acento (ex.: <i>sgt.silva</i>). Não pode repetir o de outra pessoa.'],
        [7, '<b>Senha</b> e <b>Confirmar senha</b> — no mínimo 6 caracteres; as duas precisam ser iguais.'],
        [8, 'Clique em <b>Salvar e entrar</b>. Pronto: você já está dentro do sistema.']])}
      ${gDica('Nome, posto, setor e foto podem ser alterados depois em <b>Meu perfil</b>. Lá também fica o quadro <b>Usuário e senha</b> para trocar a sua senha.')}
      ${gAtencao('O <b>primeiro usuário</b> criado no sistema vira o <b>administrador</b>. Todos os outros entram como usuários comuns.')}`},
    {t: 'Próximos acessos: só a senha', img: ['03b_login_salvo'], html: `
      ${gLista([
        [1, 'Depois do primeiro acesso, o sistema já mostra o <b>seu nome e foto</b>.'],
        [2, 'Digite apenas a <b>senha</b> e tecle Enter.'],
        [3, '<b>Entrar com outro usuário</b> — para outra pessoa usar este computador. O usuário salvo é esquecido e o login volta a pedir usuário e senha.'],
        [4, '<b>Esqueci minha senha</b> — abre o pedido ao administrador.']])}
      ${gDica('Ao sair (<b>Sair / trocar usuário</b>, no fim do menu), o sistema volta para esta tela.')}`},
    {t: 'Esqueci a senha', img: ['03c_esqueci', '03d_nova_senha'], html: `
      <p>A senha não pode ser recuperada, só <b>redefinida pelo administrador</b>.</p>
      ${gLista([
        [1, 'Em <b>Esqueci minha senha</b>, confira o seu <b>usuário</b>.'],
        [2, 'Se quiser, deixe um <b>recado</b> para o administrador (setor, ramal…).'],
        [3, 'Clique em <b>Enviar pedido</b>. O administrador vê o pedido e cria uma <b>senha provisória</b>, que ele passa para você.']])}
      <p>No próximo acesso, entre com a senha provisória. O sistema abre a tela <b>Criar nova senha</b> (segunda imagem):</p>
      ${gLista([
        [1, '<b>Nova senha</b> — diferente da provisória, com no mínimo 6 caracteres.'],
        [2, '<b>Confirmar nova senha</b>.'],
        [3, '<b>Salvar e entrar</b>. A senha provisória deixa de valer.']])}`}
  ]},
  {cap: 'Conhecendo a tela', icone: '🧭', passos: [
    {t: 'A tela principal', img: ['05_tela_principal'], html: `
      ${gLista([
        [1, '<b>Recolher o menu</b> — deixa só os ícones e libera espaço na tela. Clique de novo para abrir.'],
        [2, '<b>Seu perfil</b> — clique para editar foto, nome, posto, setor e senha.'],
        [3, '<b>Menu de funções</b> — Painel, Criar escala de ACO, Documentos, Procedimentos (oficiais), Planilhas, Guia do sistema e Meu perfil.'],
        [4, '<b>Documentos</b> — abre a lista de todos os documentos oficiais: Ofícios, Ordens de Serviço, Relatórios, Atestados, Atas e os demais modelos do manual.'],
        [5, '<b>Tema claro / escuro</b> — alterna o visual. A escolha fica salva no seu perfil.'],
        [6, '<b>Sair / trocar usuário</b> — volta para a tela de entrada.'],
        [7, '<b>Banco de dados on-line</b> — tudo o que você faz é salvo sozinho, na hora. Não existe botão de salvar.']])}
      ${gDica('Os números ao lado de cada item do menu mostram quantos registros você tem (escalas, ofícios, planilhas…).')}`},
    {t: 'Tema escuro e menu recolhido', img: ['06_tema_escuro', '07_menu_recolhido'], html: `
      <p>No tema escuro tudo funciona igual, só muda o visual. Com o menu recolhido, passe o mouse sobre os ícones para ver o nome de cada função.</p>
      ${gLista([[1, 'Clique na setinha para recolher ou abrir o menu.']])}
      ${gDica('No celular ou em telas pequenas, o menu abre pelo botão ☰ no canto superior.')}`}
  ]},
  {cap: 'Escala de ACO', icone: '📋', passos: [
    {t: 'Começando uma escala', img: ['09_aco_inicio'], html: `
      <p>Clique em <b>Criar escala de ACO</b> no menu. Existem dois tipos de escala:</p>
      ${gLista([
        [1, '<b>Escala ACO Compulsória</b> — para quem não se voluntariou. Você importa as escalas de RP e a relação geral do efetivo; o sistema bloqueia quem está de serviço na data e mostra quem está livre.'],
        [2, '<b>Escala ACO Voluntária</b> — os arquivos são opcionais. Você adiciona os voluntários pela relação do efetivo ou manualmente.'],
        [3, '<b>Almanaques de antiguidade</b> — definem a ordem dos policiais: <b>1º patente</b>, <b>2º antiguidade</b>. Quem carrega e troca os almanaques é o administrador.'],
        [4, '<b>Escalas criadas</b> — as suas escalas. Clique em <b>Abrir</b> para continuar ou corrigir uma escala.'],
        [5, '<b>Excluídas</b> — escalas apagadas ficam aqui por 1 dia e podem ser restauradas. Depois somem do sistema.']])}
      ${gDica('Cada usuário vê só as escalas que ele mesmo criou. Mesmo assim, quem já está numa ACO de outro usuário no mesmo dia aparece <b>bloqueado</b>, para ninguém tirar duas ACOs no mesmo dia.')}`},
    {t: 'A barra da escala', img: ['10_aco_topo'], html: `
      ${gLista([
        [1, '<b>← Escalas</b> — volta para a lista de escalas. Nada se perde: tudo é salvo sozinho.'],
        [2, '<b>Data da escala</b> — hoje ou uma data futura. O selo ao lado mostra <i>Hoje</i>, <i>Amanhã</i> ou <i>Futura</i>.'],
        [3, '<b>Copiar p/ outra data</b> — cria uma escala igual para outro dia. Quem estiver de RP no novo dia aparece em vermelho.'],
        [4, '<b>Excluir</b> — manda a escala para Excluídas.'],
        [5, '<b>Gerar PDF</b> — o último passo, explicado mais à frente.']])}`},
    {t: 'Passo 1 — Importar os PDFs', img: ['11_aco_arquivos'], html: `
      ${gLista([
        [1, '<b>Arraste os PDFs</b> para este quadro ou clique em <b>Selecionar arquivos</b>. São até 5 arquivos: as escalas de RP e a <b>relação geral do efetivo</b> (o sistema reconhece sozinho a relação, por ter mais de 80 pessoas).'],
        [2, 'A <b>barra de progresso</b> mostra a leitura de cada arquivo.'],
        [3, '<b>Arquivos lidos</b> — para cada escala de RP aparecem a data encontrada e quantas pessoas foram localizadas na relação geral. O selo indica se o arquivo <b>bloqueia nesta escala</b> ou se é de <b>data anterior</b> (não bloqueia ninguém).']])}
      ${gDica('Serviço que atravessa a noite (ex.: do dia 12 para o 13): preencha o campo <b>até</b>. A pessoa fica bloqueada no dia 12 e <b>livre no dia 13</b>, quando termina o serviço.')}
      ${gAtencao('Os arquivos valem só para esta escala: cada escala nova começa sem arquivos. Nenhum arquivo é obrigatório.')}`},
    {t: 'Passo 2 — Conferir a situação por data', img: ['12_aco_situacao'], html: `
      ${gLista([
        [1, '<b>Resumo</b> — total da relação geral, quantos estão de RP na data, quantos estão disponíveis e quantos já estão nesta escala.'],
        [2, '<b>Tabela por data</b> — cada data encontrada nos arquivos, quem está de serviço e de folga. Clique em <b>Ver nomes</b> para conferir as listas.']])}
      ${gDica('Regra: só bloqueia quem está de RP <b>na data do bloco</b>. Escalas de datas anteriores não bloqueiam ninguém.')}`},
    {t: 'Passo 3 — Escolher os policiais', img: ['13_aco_disponiveis'], html: `
      ${gLista([
        [1, '<b>Buscar</b> — procure por nome, posto, matrícula ou CPF.'],
        [2, '<b>Bloco que está recebendo</b> — mostra para qual cidade/data vão as pessoas clicadas. Clique em outro bloco para trocar.'],
        [3, '<b>Clique na pessoa</b> (ou no <b>+</b>) para escalar. A lista já vem em ordem de <b>patente</b> e, dentro dela, de <b>antiguidade</b> (o número “Antig.”).'],
        [4, '<b>Bloqueados</b> — quem está de RP na data. Abra para conferir. Só use <b>Liberar</b> se o sistema tiver lido algo errado.']])}
      ${gAtencao('A mesma pessoa não pode tirar duas ACOs no mesmo dia, e quem está de RP na data não pode ser escalado.')}`},
    {t: 'Passo 4 — Montar o bloco', img: ['14_aco_bloco'], html: `
      <p>Cada <b>bloco</b> é uma cidade numa data. No PDF ele vira a faixa preta com a data e a tabela com a cidade. A data do bloco fica na faixa preta do topo.</p>
      ${gLista([
        [1, '<b>Cidade</b> — escolha na lista (Paraíso, Monte Santo, Campina Verde…) ou digite outra.'],
        [2, '<b>ACO completa (12h)</b> ou <b>meia ACO (6h)</b> — vale para todos do bloco.'],
        [3, '<b>Das</b> — horário de início.'],
        [4, '<b>Às</b> — horário de término. Só existem ACOs de 6h ou 12h: menos de 8h vira meia (6h), mais de 8h vira completa (12h); com exatamente 8h o sistema pergunta.'],
        [5, '<b>Mover / excluir bloco</b> — muda a ordem dos blocos no PDF ou apaga o bloco.'],
        [6, '<b>Horário no PDF</b> — como o horário vai sair no documento.'],
        [7, '<b>Nome de guerra</b> — clique nas palavras do nome que são o nome de guerra. Elas ficam escuras aqui e saem em <b>negrito</b> no PDF.'],
        [8, '<b>⇄ Trocar</b> a pessoa por outra da lista, ou <b>✕ remover</b> do bloco.'],
        [9, '<b>Adicionar manualmente</b> — para quem não está na relação geral.'],
        [10, '<b>Ordem automática</b> — o bloco se organiza sozinho por patente e antiguidade. Com ✓ está tudo certo; se aparecer ⚠, faltam os almanaques ou alguém não está neles.']])}`},
    {t: 'Mais cidades e meia ACO', img: ['15_aco_bloco_meia'], html: `
      ${gLista([
        [1, '<b>Meia ACO · 6h</b> — escolhida no bloco, vale para todos os policiais dele (mesma cidade e horário). No Painel, a meia conta <b>0,5</b> e a completa conta <b>1</b>.'],
        [2, 'O <b>horário no PDF</b> se ajusta sozinho (ex.: das 08h00 às 14h00).'],
        [3, '<b>+ Novo bloco</b> — cria outra cidade ou outra data na mesma escala. Tudo sai num único PDF.']])}`},
    {t: 'Passo 5 — Texto do documento', img: ['16_aco_texto'], html: `
      <p>Abra <b>5. Texto do documento</b> para conferir o que sai no PDF. O sistema reaproveita os textos da última escala (uniforme, armamento, assinatura…).</p>
      ${gLista([
        [1, '<b>Nº da escala no mês</b> — usado no nome do arquivo (ex.: ACO Nº 01-2026 – NOVEMBRO). Já vem preenchido.'],
        [2, '<b>Operação</b> — por exemplo, <i>OPERAÇÃO ENEM</i>.'],
        [3, '<b>SGD</b> — número do processo, aparece abaixo da operação.'],
        [4, '<b>Observações</b> — uma por linha (viram a, b, c…). Escreva <code>**texto**</code> para deixar em negrito.']])}`},
    {t: 'Passo 6 — Gerar o PDF', img: ['17_aco_gerar'], html: `
      <p>Clique em <b>Gerar PDF</b> no topo da escala. Antes de gerar, o sistema confere tudo e abre esta janela:</p>
      ${gLista([
        [1, '<b>Tipo de cada bloco</b> — confirme se é ACO completa ou meia. Se algum policial estiver perto do limite de ACOs, o aviso aparece aqui.'],
        [2, '<b>Observação no final</b> (opcional) — sai depois das tabelas, antes da assinatura.'],
        [3, '<b>Gerar sem observação</b>.'],
        [4, '<b>Gerar PDF</b> — o arquivo é baixado no seu computador ou celular. A contagem do Painel é atualizada.']])}
      ${gAtencao('O PDF não é gerado se alguém estiver de RP na data. Troque (⇄) ou remova a pessoa e gere de novo.')}`},
    {t: 'O PDF pronto', img: ['18_aco_pdf'], html: `
      <p>O documento segue o modelo oficial do 8º BPM: cabeçalho, operação, uniforme, armamento, observações e, para cada bloco, a faixa com a data e a tabela com posto, nome (nome de guerra em negrito), matrícula e horário.</p>
      ${gDica('Os avisos de limite de ACOs <b>nunca</b> saem no PDF. Eles aparecem só no Painel e na janela antes de gerar.')}`},
    {t: 'Gerar de novo: correção ou nova ACO', img: ['19_aco_regerar'], html: `
      <p>Se você gerar o PDF de uma escala que já foi gerada, o sistema pergunta o que é:</p>
      ${gLista([
        [1, '<b>Correção desta ACO</b> — corrigiu um nome, horário ou cidade. A contagem anterior é <b>substituída</b>, sem contar em dobro.'],
        [2, '<b>Nova ACO</b> — é outro serviço. Ela <b>soma</b> no Painel e vira uma ACO separada, com o próximo número.']])}
      ${gAtencao('Cada policial só pode tirar <b>uma ACO por dia</b>. Se alguém já estiver em outra ACO no mesmo dia, o sistema avisa.')}`},
    {t: 'Copiar, excluir e restaurar', html: `
      ${gLista([
        ['', '<b>Copiar p/ outra data</b> — repete a escala em outro dia. Confira quem ficou em vermelho (de RP na nova data).'],
        ['', '<b>Excluir</b> — a escala vai para <b>Excluídas</b>, deixa de contar no Painel e deixa de bloquear pessoas nas outras escalas.'],
        ['', '<b>Restaurar</b> — em Excluídas, dentro de 1 dia. Depois desse prazo a escala some do sistema.']])}
      ${gDica('Enquanto a escala está em Excluídas, as ACOs dela <b>não contam</b> no Painel. Restaurando, voltam a contar.')}`}
  ]},
{cap: 'Documentos: Ofícios', icone: '✉️', passos: [
    {t: 'O menu Documentos', img: ['34_docs_menu'], html: `
      <p>Todos os documentos oficiais ficam juntos em <b>Documentos</b>. Todos funcionam do mesmo jeito: <b>escolher o modelo → editar → gerar o PDF</b> com as regras do Manual de Redação Oficial da PMTO.</p>
      ${gLista([
        [1, '<b>Documentos</b> — clique para abrir ou fechar a lista.'],
        [2, '<b>Ofícios</b> — ofício para autoridades militares, civis e ofício circular.'],
        [3, '<b>Ordens de Serviço</b> — a O.S. em tabela, com itens e subitens.'],
        [4, '<b>Demais documentos</b> — Relatórios, Atestados e Certidões, Atas, Termos, Boletins, Escalas, Parte Diária, Planos de Curso, Memorandos, Despachos, Portarias, Requerimentos e outros, todos tirados dos modelos do manual.']])}`},
    {t: 'O Manual de Redação', img: ['25_of_manual'], html: `
      <p>Os documentos seguem o <b>Manual de Redação Oficial da PMTO</b>, que já vem <b>dentro do sistema</b>: não é preciso importar nada.</p>
      ${gLista([
        [1, '<b>Manual em uso</b> — os selos mostram o que foi lido: regras de formatação, quadros de pronomes de tratamento, modelos e as expressões que o manual manda evitar.'],
        [2, '<b>Trocar manual</b> — só o <b>administrador</b>: quando sair uma versão nova, ele importa o arquivo Word (.docx) e a versão nova passa a valer para todos.'],
        [3, '<b>Ver as regras</b> — mostra cada regra lida (fonte, margens, espaçamentos…) e o trecho do manual de onde ela veio.']])}`},
    {t: 'Novo ofício: escolher o modelo', img: ['33_of_lista'], html: `
      ${gLista([
        [1, '<b>Escolha o modelo</b>: Ofício – Autoridades Militares, Ofício – Autoridades Civis ou Ofício Circular.'],
        [2, '<b>Meus ofícios</b> — os que você já fez. Clique em <b>Abrir</b> para continuar, corrigir ou gerar de novo.']])}`},
    {t: 'A tela do ofício', img: ['26_of_editor'], html: `
      ${gLista([
        [1, '<b>← Ofícios</b> — volta à lista (tudo é salvo sozinho).'],
        [2, '<b>Nº automático</b> — pega o próximo número livre da sua seção no ano, entre os seus ofícios.'],
        [3, '<b>Preencher com o exemplo do manual</b> — mostra como fica o modelo preenchido.'],
        [4, '<b>Excluir</b> o ofício.'],
        [5, '<b>Gerar PDF</b>.'],
        [6, '<b>Prévia</b> — a folha exatamente como vai sair, atualizada enquanto você digita.']])}
      ${gDica('O botão <b>Editar arquivo já feito</b> (explicado mais à frente) traz um ofício pronto para dentro do sistema.')}`},
    {t: 'Cabeçalho, número e data', img: ['27_of_identificacao'], html: `
      ${gLista([
        [1, '<b>Cabeçalho</b> — as duas linhas da unidade, em caixa alta.'],
        [2, '<b>Número</b> — com 3 algarismos (001, 002…).'],
        [3, '<b>SGD</b> — se o documento estiver no sistema de gestão de documentos.'],
        [4, '<b>Seções que expedem</b>, da menor para a maior (ex.: P/3 e 8º BPM). A barra dentro da sigla sai sozinha: P/3 vira P3.'],
        [5, '<b>Cidade e UF</b>.'],
        [6, '<b>Data</b> — sai por extenso, com “1º” no primeiro dia do mês.']])}`},
    {t: 'Destinatário', img: ['28_of_destinatario'], html: `
      ${gLista([
        [1, '<b>Quem é o destinatário</b> — escolha nos quadros de tratamento do manual. O sistema monta “Ao Senhor” ou “A Sua Excelência o Senhor” e o vocativo.'],
        [2, '<b>Senhor ou Senhora</b>.'],
        [3, '<b>Destinatário militar</b> — marque para o posto sair antes do nome.'],
        [4, '<b>Posto/graduação e quadro</b> (ex.: CEL QOPM).'],
        [5, '<b>Nome completo</b> — sai em negrito.'],
        [6, '<b>Função ou cargo</b>.'],
        [7, '<b>Endereço ou nome do órgão</b>, cidade e UF.']])}`},
    {t: 'Assunto, vocativo e texto', img: ['29_of_texto'], html: `
      ${gLista([
        [1, '<b>Assunto</b> — sem verbo (ex.: “Solicitação de…”). Sai em negrito.'],
        [2, '<b>Anexos</b> — um por linha.'],
        [3, '<b>Vocativo</b> — montado pelo quadro de tratamento; desmarque para escrever outro. Para subordinado, pode ficar sem vocativo.'],
        [4, '<b>Texto</b> — um parágrafo por linha. Use **negrito** e *itálico*.']])}
      ${gAtencao('O manual manda evitar frases feitas como “Venho por meio desta” ou “para as providências cabíveis”. A conferência avisa se aparecerem.')}`},
    {t: 'Fecho, assinatura e rodapé', img: ['30_of_assinatura'], html: `
      ${gLista([
        [1, '<b>Fecho</b> — Respeitosamente (para superior) ou Atenciosamente (mesmo nível ou subordinado).'],
        [2, '<b>Nome completo</b> de quem assina.'],
        [3, '<b>Posto e quadro</b> — saem em negrito.'],
        [4, '<b>Nome de guerra</b> — clique nas palavras; elas saem em negrito.'],
        [5, '<b>Função</b>.'],
        [6, '<b>Rodapé</b> — endereço e contato da unidade, em Arial 10.']])}`},
    {t: 'Conferir e gerar o PDF', img: ['31_of_conferencia', '32_of_pdf'], html: `
      ${gLista([
        [1, '<b>Resultado da conferência</b> — “Tudo conforme o manual” ou quantos pontos faltam ajustar.'],
        [2, '<b>Cada regra conferida</b>, com o que falta (assunto com verbo, nome de guerra sem marcar, frase feita…).']])}
      <p>Clique em <b>Gerar PDF</b>. O arquivo é baixado com o nome no padrão do manual (ex.: <i>Ofício 001-2026 – P3 – Assunto.pdf</i>).</p>
      ${gDica('Se a assinatura fosse ficar sozinha numa página, o sistema leva as últimas linhas do texto junto e, se precisar, usa Arial 11 — exceção prevista no manual.')}`},
    {t: 'Editar arquivo já feito', img: ['42_importar'], html: `
      <p>Tem um documento pronto, em <b>PDF ou Word</b>, fora do padrão? O sistema traz o conteúdo dele e reorganiza no formato do manual.</p>
      ${gLista([
        [1, 'Clique em <b>Editar arquivo já feito</b> e escolha o arquivo.'],
        [2, 'Cada parte vai para o seu campo: cabeçalho, número, data, destinatário, assunto, texto, assinatura…'],
        [3, 'A prévia já mostra o documento <b>no padrão do manual</b>, com o seu conteúdo. Confira, edite o que quiser e gere o PDF.']])}
      ${gDica('Funciona em todos os documentos: Ofício, Ordem de Serviço e todos os modelos do manual.')}
      ${gAtencao('PDF escaneado (foto do papel) não tem texto para ler. Nesse caso, use o arquivo original do Word ou o PDF gerado pelo SGD.')}`}
  ]},
  {cap: 'Documentos: Ordem de Serviço', icone: '🗂️', passos: [
    {t: 'Começar uma Ordem de Serviço', img: ['35_os_inicio'], html: `
      <p>A Ordem de Serviço usa as regras e o modelo que o sistema leu do manual (a O.S. é montada em tabela).</p>
      ${gLista([
        [1, '<b>+ Nova Ordem de Serviço</b> — já vem com a estrutura base: Missão, Administração, Atribuições, Condições de Execução, Elementos Subordinados e Ligações.'],
        [2, '<b>Ver as regras da O.S.</b> — células com 6 pt antes e depois, texto justificado, itens numerados em negrito e caixa alta, assinatura fora da tabela.']])}`},
    {t: 'A tela da O.S.', img: ['36_os_editor'], html: `
      ${gLista([
        [1, '<b>← Ordens de Serviço</b> — volta à lista.'],
        [2, '<b>Editar arquivo já feito</b> — traz uma O.S. pronta (PDF ou Word) com todos os itens no lugar.'],
        [3, '<b>Nº automático</b>.'],
        [4, '<b>Preencher com o exemplo do manual</b>.'],
        [5, '<b>Duplicar</b> — nova O.S. com os mesmos itens, para operações parecidas.'],
        [6, '<b>Gerar PDF</b> — o arquivo é baixado.'],
        [7, '<b>Aos, Evento, Referência e Anexos</b> — sem numeração, como manda o manual.'],
        [8, '<b>Prévia</b> da tabela, ao vivo.']])}`},
    {t: 'Itens e subitens', img: ['37_os_itens'], html: `
      ${gLista([
        [1, '<b>Título do item</b> — sai numerado, em negrito e caixa alta.'],
        [2, '<b>Tipo</b> — subitens (rótulo | texto), texto corrido ou ligações (contato | número).'],
        [3, '<b>Subir, descer ou excluir</b> o item. A numeração se ajusta sozinha.'],
        [4, '<b>Rótulo do subitem</b> (ex.: Geral, Fardamento) — numerado sozinho (1.1, 4.3…).'],
        [5, '<b>Texto do subitem</b> — uma linha por parágrafo. Comece com <b>a)</b>, <b>b)</b> para alíneas, <b>-</b> para subdivisões e <b>✓</b> para marcadores.'],
        [6, '<b>+ Subitem</b>. No fim da lista há <b>+ Novo item</b>.']])}`},
    {t: 'A O.S. pronta', img: ['38_os_pdf'], html: `
      <p>A O.S. sai em tabela: epígrafe e data lado a lado, difusão, itens e subitens, e a assinatura fora da tabela. Linhas grandes continuam na página seguinte e o título de um item nunca fica sozinho no pé da página.</p>`}
  ]},
  {cap: 'Documentos: modelos do manual', icone: '📚', passos: [
    {t: 'Escolher o modelo', img: ['39_dm_modelos'], html: `
      <p>Relatórios, Atestados, Certidões, Declarações, Atas, Termos, Boletins, Escalas, Parte Diária, Planos de Curso, Memorandos, Despachos, Portarias, Requerimentos e os demais: <b>todos vêm dos modelos do apêndice do manual</b>, com a formatação de cada parágrafo e de cada tabela.</p>
      ${gLista([
        [1, '<b>Clique no modelo</b> para começar um documento novo.'],
        [2, '<b>Meus documentos</b> — os que você já fez, para abrir e continuar.']])}`},
    {t: 'Editar o documento', img: ['40_dm_editor'], html: `
      ${gLista([
        [1, '<b>Editar arquivo já feito</b> — traz um documento pronto e coloca cada parágrafo na formatação do parágrafo certo do modelo.'],
        [2, '<b>Restaurar modelo</b> — volta ao texto original do manual.'],
        [3, '<b>Gerar PDF</b> — o arquivo é baixado.'],
        [4, '<b>Brasão do cabeçalho</b> — vem do manual. As linhas da unidade já vêm com a sua.'],
        [5, '<b>Numeração</b> do parágrafo (1., a), I…), que você pode mudar.'],
        [6, '<b>Linha em branco</b> do modelo — pode excluir ou escrever nela.'],
        [7, '<b>Prévia</b> ao vivo e, abaixo dela, a conferência e o que o manual diz sobre esse documento.']])}`},
    {t: 'Cada caixa é um parágrafo', img: ['41_dm_paragrafo'], html: `
      ${gLista([
        [1, '<b>Numeração</b> do parágrafo.'],
        [2, '<b>Texto</b> — já com a formatação do modelo (alinhamento, recuo, espaçamento). Use **negrito**, *itálico* e ++sublinhado++.'],
        [3, '<b>+</b> cria outro parágrafo igual logo abaixo (a numeração continua: depois de 1. vem 2.); <b>↑ ↓</b> mudam a ordem; <b>✕</b> exclui.']])}
      ${gDica('Nas tabelas, use <b>+ Linha</b> para acrescentar linhas com a mesma formatação.')}
      ${gAtencao('A conferência avisa se ainda sobrou “Fulano”, “Beltrano” ou “[...]” do exemplo do manual.')}`}
  ]},
  {cap: 'Editar direto no PDF', icone: '✍️', passos: [
    {t: 'Clique no texto da prévia', img: ['45_pv_editar'], html: `
      <p>Em <b>Ofícios</b>, <b>Ordens de Serviço</b>, nos modelos de <b>Documentos</b> e nos <b>Procedimentos</b>, a folha funciona <b>como no Word</b>: clique em qualquer letra e escreva, apague, selecione, use as setas e o Enter.</p>
      ${gLista([
        [1, '<b>A folha</b> — clique em qualquer texto: o cursor vai para a letra clicada. Enquanto você digita, as linhas se reorganizam; ao parar, o PDF é refeito pelas regras do manual (fonte, margens, recuos e espaçamentos não mudam) e o cursor continua onde estava.'],
        [2, '<b>Barra de edição</b> — <b>B</b>, <b>I</b>, <b>U</b> (ou Ctrl+B / I / U), <b>+ Parágrafo</b> e <b>Excluir parágrafo</b>.'],
        [3, '<b>Voltar ao automático</b> — epígrafe, data, “Ao Senhor”, vocativo, fecho e assinatura são montados pelo sistema, mas você pode reescrevê-los na folha (ex.: “Excelentíssimo Senhor”). Este botão desfaz e volta ao texto automático.'],
        [0, '<b>Mostrar campos</b> (no alto, ao lado de Gerar PDF) — abre o formulário ao lado da folha, para quem preferir preencher por campos.']])}
      ${gDica('No texto corrido, <b>Enter</b> divide o parágrafo no cursor (como no Word) e <b>Backspace</b> no começo junta com o parágrafo de cima. <b>Shift+Enter</b> quebra a linha. Nas células da Ordem de Serviço, Enter cria uma linha nova dentro da célula.')}
      ${gAtencao('A conferência ao lado continua valendo: se o que foi digitado fugir da regra (ex.: fecho diferente de “Respeitosamente,” ou “Atenciosamente,”), ela avisa.')}`}
  ]},
  {cap: 'Procedimentos (oficiais)', icone: '⚖️', oficial: true, passos: [
    {t: 'Onde ficam os procedimentos', img: ['42_pr_modelos'], html: `
      <p>O menu <b>Procedimentos</b> só aparece para quem está cadastrado como <b>Oficial</b>. Ele traz as <b>78 peças</b> do <b>Manual de Processos e Procedimentos Administrativos (MPPADMIS)</b> da PMTO, com o mesmo texto e a mesma disposição dos modelos do manual.</p>
      ${gLista([
        [1, '<b>Procedimentos</b> — clique para abrir e fechar a lista.'],
        [2, '<b>Sindicância</b> e <b>Conselho de Disciplina / Justificação</b> — as peças estão separadas pela fase do processo: instauração, escrivão, citação, oitivas, perícias, prazos, relatório, solução…'],
        [3, '<b>Clique na peça</b> para começar. Cada cartão mostra a página do MPPADMIS de onde ela vem.'],
        [4, '<b>Meus documentos</b> — as peças que você já começou, para abrir e continuar.']])}
      ${gDica('Não é preciso importar nada: os modelos do MPPADMIS já estão dentro do sistema. O quadro <b>Manual de Procedimentos</b>, no alto da tela, mostra a versão em uso; quando sair uma versão nova, o <b>administrador</b> importa o PDF em <b>Importar versão nova</b> e os modelos se atualizam para todos.')}`},
    {t: 'Preencher a peça', img: ['43_pr_editor'], html: `
      ${gLista([
        [1, '<b>Cabeçalho</b> — brasão da PMTO, “ESTADO DO TOCANTINS”, “POLÍCIA MILITAR” e o nome da <b>sua unidade</b> no lugar de “UNIDADE MILITAR”.'],
        [2, '<b>Número do processo</b> — complete o “SINDICÂNCIA Nº____” (ou do Conselho). Ele vira o nome do documento na lista.'],
        [3, '<b>Texto da peça</b> — troque as orientações entre parênteses, como <i>(posto, quadro e nome)</i> e <i>(citar o boletim)</i>, pelos dados do caso, e preencha as lacunas “___”.'],
        [4, '<b>Gerar PDF</b> — com o cabeçalho e a formatação do modelo. Também funcionam <b>Editar arquivo já feito</b>, <b>Restaurar modelo</b> e <b>Duplicar</b>, iguais aos de Documentos.']])}
      ${gAtencao('Peças como o <b>Relatório</b> trazem vários exemplos (Ex. 01, Ex. 02…) de conclusão. Apague os que não se aplicam ao caso.')}`},
    {t: 'Conferência da peça', img: ['44_pr_conf'], html: `
      <p>Ao lado da prévia, a conferência mostra o que ainda falta antes de gerar o PDF:</p>
      ${gLista([
        [1, '<b>Pontos para ajustar</b> — quantos itens ainda estão pendentes.'],
        [2, '<b>Lista da conferência</b> — nome da unidade no cabeçalho, lacunas “___” em branco, orientações “(citar…)” que sobraram, exemplos do manual e a data.'],
        [3, '<b>O que o MPPADMIS diz sobre esta peça</b> — o texto do manual que vem antes do modelo (prazos, competência, cuidados). Clique para abrir.']])}`}
  ]},
  {cap: 'Painel', icone: '📊', passos: [
    {t: 'ACOs tiradas por policial', img: ['20_painel_ranking'], html: `
      <p>O Painel mostra quantas ACOs cada policial tirou. A contagem é feita sozinha toda vez que um PDF de ACO é gerado.</p>
      ${gLista([
        [1, '<b>Período</b> — este mês, últimos 3 meses, este ano ou todo o período.'],
        [2, '<b>Buscar policial</b> — por nome, posto ou matrícula.'],
        [3, '<b>Faixas de quantidade</b> — clique numa faixa (ex.: <i>25–29 perto do limite</i>) para ver só os policiais dela. Clique de novo para mostrar todos. O número em cada faixa diz quantos policiais estão nela.'],
        [4, '<b>Clique na linha</b> para ver o detalhe: data, cidade e número de cada ACO.']])}
      ${gDica('Completa conta 1 e meia conta 0,5 (ex.: 1 completa + 1 meia = 1,5). As cores mudam conforme a quantidade aumenta, até o limite (30 por ano, definido pelo administrador).')}`}
  ]},
  {cap: 'Planilhas', icone: '📑', passos: [
    {t: 'Criar e editar planilhas', img: ['21_planilhas'], html: `
      ${gLista([
        [1, '<b>Nova planilha</b> — dê um nome e ela aparece na lista à esquerda.'],
        [2, '<b>Importar CSV</b> — traz uma tabela exportada do Excel (salve no Excel como CSV).'],
        [3, '<b>Barra da planilha</b> — + Linha, + Coluna, Renomear, Duplicar, Exportar CSV, Excluir e o campo para filtrar linhas.'],
        [4, '<b>Tabela</b> — clique numa célula para digitar. No ⚙ do cabeçalho você renomeia a coluna e escolhe o tipo (texto, número, data…).']])}
      ${gDica('Exportar CSV gera um arquivo que abre direto no Excel.')}`}
  ]},
  {cap: 'Seus dados', icone: '💾', passos: [
    {t: 'Onde ficam os seus dados', html: `
      ${gLista([
        ['', '<b>Banco de dados on-line</b> — escalas, contagem de ACOs, ofícios, ordens de serviço, documentos, planilhas e perfis ficam guardados na internet, com cópia de segurança feita pelo próprio serviço.'],
        ['', '<b>Salvamento automático</b> — cada alteração é salva sozinha, menos de um segundo depois. Na escala de ACO, o aviso “✓ Salvo” aparece no topo.'],
        ['', '<b>Em qualquer lugar</b> — entre pelo endereço do sistema em outro computador ou no celular e tudo estará lá.'],
        ['', '<b>Privacidade</b> — cada usuário vê só o que ele mesmo criou. Almanaques, manuais e a contagem de ACOs são comuns a todos.']])}
      ${gAtencao('Em computador compartilhado, use <b>Sair / trocar usuário</b> ao terminar e desmarque “Salvar meu usuário neste computador”.')}`}
  ]},
  {cap: 'Administração', icone: '🛡️', admin: true, passos: [
    {t: 'Usuários e pedidos de senha', img: ['46_admin_usuarios'], html: `
      <p>Só o <b>administrador</b> vê esta parte, em <b>Meu perfil</b>.</p>
      ${gLista([
        [1, '<b>Pedidos de redefinição de senha</b> — quem esqueceu a senha aparece aqui. Crie uma <b>senha provisória</b> e passe para a pessoa; no próximo acesso ela cria a senha dela.'],
        [2, '<b>Usuários cadastrados</b> — mude o círculo (Oficial/Praça), redefina a senha ou exclua o usuário.']])}`},
    {t: 'Registros de atividades', img: ['47_registros'], html: `
      <p>Em <b>Registros</b> fica tudo o que foi feito no sistema: quem entrou, quem criou ou excluiu escalas e documentos, PDFs gerados, arquivos importados.</p>
      ${gLista([
        [1, '<b>Filtrar por tipo</b> de atividade.'],
        [2, '<b>Buscar</b> por nome ou ação.'],
        [3, '<b>A lista</b> — data e hora, quem fez e o que fez.']])}`},
    {t: 'O que só o administrador faz', html: `
      ${gLista([
        ['', '<b>Almanaques de antiguidade</b> — em Criar escala de ACO, botão <b>Trocar almanaques</b>. Valem para todos.'],
        ['', '<b>Limite de ACOs</b> — no Painel, botão <b>Limite</b>: quantidade máxima, a partir de quando avisar e o período (mês, ano ou total).'],
        ['', '<b>Manuais</b> — trocar o Manual de Redação (em Ofícios) e o Manual de Procedimentos (no alto das telas de Procedimentos).'],
        ['', '<b>Excluídas</b> — excluir de vez as escalas que estão em Excluídas.']])}`}
  ]},
  {cap: 'Meu perfil', icone: '👤', passos: [
    {t: 'Editar o seu perfil', img: ['23_perfil'], html: `
      ${gLista([
        [1, '<b>Trocar foto</b> ou remover.'],
        [2, '<b>Nome, posto e setor</b> — aparecem no menu e nos registros do que você faz.'],
        [3, '<b>Usuário e senha</b> — para trocar a sua senha.'],
        [4, '<b>Salvar</b>.']])}`},
    {t: 'Pronto!', html: `
      <div class="g-fim">🎉</div>
      <p style="text-align:center">Você já conhece todo o sistema. Agora é só começar, por exemplo criando a sua primeira <b>escala de ACO</b>.</p>
      <p style="text-align:center">Se tiver dúvida, reabra este guia a qualquer momento pelo menu, em <b>Guia do sistema</b>.</p>
      ${''}`}
  ]}
];

