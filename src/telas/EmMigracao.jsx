const ETAPAS = {
  aco: ['Etapa 2', 'Criar escala de ACO, importação das escalas de RP e da relação geral, antiguidade pelos almanaques e geração do PDF.'],
  painel: ['Etapa 2', 'Painel com a contagem de ACOs por policial.'],
  oficio: ['Etapa 3', 'Ofícios no padrão do manual, com a folha editável e “Editar arquivo já feito”.'],
  os: ['Etapa 3', 'Ordens de Serviço em tabela, com a folha editável.'],
  docm: ['Etapa 3', 'Modelos do Manual de Redação (e Procedimentos do MPPADMIS, para oficiais).'],
  planilhas: ['Etapa 4', 'Planilhas do setor.']
};
export default function EmMigracao({ chave, nome }){
  const [etapa, txt] = ETAPAS[chave] || ['Próximas etapas', ''];
  return (
    <section className="view ativa">
      <div className="card preparo">
        <div className="ic-arq doc">{etapa.replace('Etapa ', 'E')}</div>
        <h3>{nome} — em migração para a nova versão</h3>
        <p>{txt}</p>
        <p className="dica">Esta parte está sendo convertida para React com o banco de dados on-line ({etapa}). Os dados já importados do sistema anterior ficam guardados no banco e aparecem aqui quando a tela estiver pronta.</p>
      </div>
    </section>
  );
}
