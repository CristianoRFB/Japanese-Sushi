'use client';

import { ArrowRight, BookOpenText, Bike, CircleHelp, ClipboardList, CreditCard, DoorOpen, ShoppingBag } from 'lucide-react';

import { AdminShell } from '@/components/admin-shell';

const workflows = [
  { title: 'Pedidos e alterações', text: 'Aceite ou recuse os pedidos novos. Se precisar trocar item, quantidade ou preço, envie a proposta ao cliente e aguarde a resposta antes de iniciar o preparo.', href: '/admin/pedidos', label: 'Abrir pedidos', icon: ShoppingBag },
  { title: 'Cozinha e expedição', text: 'A cozinha avança o pedido até Pronto. Retiradas podem ser concluídas pela equipe; pedidos de delivery seguem para a Central de entregas.', href: '/admin/kds', label: 'Abrir cozinha', icon: ClipboardList },
  { title: 'Central de entregas', text: 'Atribua uma corrida a um motoboy disponível. O profissional aceita ou recusa, confirma a retirada, inicia a rota e informa quando chegou ao cliente.', href: '/admin/entregas', label: 'Abrir entregas', icon: Bike },
  { title: 'Caixa do turno', text: 'Abra o turno com o fundo contado. Registre vendas do balcão, suprimentos e sangrias; no fechamento, informe o dinheiro físico para calcular a diferença.', href: '/admin/caixa', label: 'Abrir caixa', icon: DoorOpen },
  { title: 'Cardápio e adicionais', text: 'Atualize nomes, imagens, tamanhos, preços, disponibilidade e combinações. Revise o produto no cardápio público após salvar.', href: '/admin/catalogo', label: 'Abrir cardápio', icon: BookOpenText },
  { title: 'Finanças e promoções', text: 'Finanças reúne entradas e despesas por mês. As vendas do caixa entram no histórico automaticamente; promoções precisam de vigência válida e status ativo.', href: '/admin/financas', label: 'Abrir finanças', icon: CreditCard },
];

const questions = [
  ['O cliente não recebeu o código do pedido. O que faço?', 'Abra o pedido pelo número ou nome na fila. O cliente também pode consultar o código salvo neste navegador. Para delivery, o código de recebimento aparece no acompanhamento depois que a corrida é atribuída.'],
  ['O cliente ainda não aceitou uma alteração.', 'O pedido fica em espera enquanto a proposta estiver pendente. Não avance o preparo; a equipe precisa aguardar a resposta do cliente ou entrar em contato pelo canal configurado.'],
  ['Não consigo atribuir um motoboy.', 'Confira se o pedido está Pronto e marcado como delivery, se o motoboy está ativo e disponível e se ele não tem outra corrida em andamento.'],
  ['O motoboy chegou, mas não concluiu a entrega.', 'O profissional envia o código de recebimento no portal. A equipe confere a solicitação na Central de entregas; código incorreto precisa ser revisado antes de liberar nova tentativa.'],
  ['O caixa não abre.', 'Só uma conta administradora pode abrir o turno. Se já existir um caixa aberto, feche ou atualize a tela para encontrar o turno atual.'],
  ['Como registrar Pix ou cartão sem alterar o dinheiro físico?', 'No caixa, registre a venda com a forma correta. Pix e cartão entram no total de vendas e em Finanças, mas não aumentam o dinheiro esperado na gaveta.'],
  ['A reserva caiu em conflito de mesa.', 'Na Agenda, escolha outra mesa com capacidade suficiente. Uma mesa não pode atender duas reservas no mesmo horário.'],
  ['Como faço uma oferta temporária?', 'Crie a promoção, informe o período, selecione os produtos e ative. Confira o cardápio público após salvar para validar o preço exibido.'],
];

export default function AdminHelpPage() {
  return <AdminShell adminOnly>
    <header><p className="text-xs font-black uppercase tracking-[.18em] text-[#b5232b]">Teiko Sushi · Operação</p><h1 className="teiko-display mt-2 text-4xl tracking-[-.04em]">Central de ajuda</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[#66716a]">Atalhos e respostas rápidas para os fluxos do salão, cozinha, caixa e delivery.</p></header>
    <section className="mt-7 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{workflows.map(({ title, text, href, label, icon: Icon }) => <article key={title} className="flex min-h-56 flex-col rounded-[26px] bg-white p-5 shadow-sm"><span className="grid size-11 place-items-center rounded-2xl bg-[#f3f0e8] text-[#b5232b]"><Icon className="size-5" /></span><h2 className="mt-4 text-lg font-black">{title}</h2><p className="mt-2 flex-1 text-sm leading-6 text-[#66716a]">{text}</p><a href={href} className="mt-4 inline-flex min-h-10 items-center gap-2 text-sm font-black text-[#b5232b]">{label}<ArrowRight className="size-4" /></a></article>)}</section>
    <section className="mt-7 rounded-[28px] bg-[#0b100e] p-5 text-white sm:p-7"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-[#c7a773] text-[#0b100e]"><CircleHelp className="size-5" /></span><div><p className="text-xs font-black uppercase tracking-[.16em] text-[#c7a773]">Dúvidas frequentes</p><h2 className="text-2xl font-black">Respostas da operação</h2></div></div><div className="mt-5 divide-y divide-white/12">{questions.map(([question, answer]) => <details key={question} className="group py-4"><summary className="cursor-pointer list-none pr-8 text-sm font-black marker:hidden focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#c7a773] [&::-webkit-details-marker]:hidden">{question}<span aria-hidden="true" className="float-right text-[#c7a773] group-open:rotate-45">+</span></summary><p className="mt-3 max-w-3xl text-sm leading-6 text-white/70">{answer}</p></details>)}</div></section>
  </AdminShell>;
}
