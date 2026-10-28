/**
 * O servidor do Malha Viva.
 *
 * Tudo o que o site tem — páginas, bairro, vídeos — está na pasta `public`
 * e é servido directamente pela Cloudflare, antes de chegar aqui (ver
 * `assets` em `wrangler.jsonc`). A este código só chegam duas coisas:
 *
 *  - os pedidos das páginas pesadas do site (`run_worker_first`, em
 *    `wrangler.jsonc`), para se poder recusar o pré-carregamento (abaixo);
 *  - um endereço que não corresponda a nenhum ficheiro: o de uma casa
 *    (/casa/D31, ver `casaDoEndereco`) abre a navegação até ela; os outros
 *    têm sempre a resposta de que não existem.
 *
 * Porquê recusar o pré-carregamento. Quando alguém começa a escrever
 * "malhaviva.pt" na barra do Chrome, o Chrome adivinha para onde a pessoa
 * vai e carrega a página em segundo plano, escondida, para a mostrar mais
 * depressa ("prerender"). O pedido vem com o cabeçalho
 * `Sec-Purpose: prefetch;prerender`. O motor 3D do bairro, a arrancar numa
 * página escondida assim, deixa o separador preso para sempre: o círculo
 * roda, a página fica escura e o Chrome diz "Página sem resposta" — e a
 * pessoa nunca chega a ver o bairro. Respondendo a esse pedido com um erro,
 * o Chrome desiste do pré-carregamento e, quando a pessoa carrega em Enter,
 * abre a página como qualquer outra. Perde-se meio segundo de vantagem;
 * ganha-se um site que abre. (Verificado a reproduzir o bloqueio num Chrome
 * limpo e a desaparecer com esta recusa: ver `scripts/testar-prerender.mjs`.)
 */

/** Quem pede o pré-carregamento de uma página diz-o neste cabeçalho. */
export function eUmPreCarregamento(pedido: Request): boolean {
	return (pedido.headers.get('Sec-Purpose') ?? '').toLowerCase().includes('prerender');
}

/**
 * O endereço de uma casa: malhaviva.pt/casa/D31 — e, para um número que o
 * levantamento tem em dois sítios, malhaviva.pt/casa/D31/2. Não é um
 * ficheiro: é a página da navegação (public/navegacao.html), que lê o
 * número do próprio endereço e abre já com o percurso até essa casa. É o
 * endereço que quem mora no bairro manda a quem o vem visitar.
 */
const CASA = /^\/casa\/([A-Za-z0-9.]{1,12})(?:\/([1-9]))?\/?$/;

/** A casa de um endereço /casa/…, ou nada. */
export function casaDoEndereco(caminho: string): { numero: string; sitio: number } | null {
	const m = CASA.exec(caminho);
	return m ? { numero: m[1].toUpperCase(), sitio: m[2] ? Number(m[2]) : 1 } : null;
}

/**
 * A página da navegação com o nome da casa no título e na descrição: é o
 * que as aplicações de mensagens mostram na pré-visualização do endereço
 * ("Casa D31 — Bairro de Penajóia").
 */
function paginaDaCasa(pagina: Response, numero: string, endereco: URL): Response {
	const titulo = `Casa ${numero} — Bairro de Penajóia`;
	const descricao = `Como chegar à casa ${numero} no Bairro de Penajóia: o caminho no mapa, passo a passo.`;
	const conteudo = (valor: string) => ({ element(e: Element) { e.setAttribute('content', valor); } });
	return new HTMLRewriter()
		.on('title', { element(e) { e.setInnerContent(titulo); } })
		.on('meta[name="description"]', conteudo(descricao))
		.on('meta[property="og:title"]', conteudo(titulo))
		.on('meta[property="og:description"]', conteudo(descricao))
		.on('meta[property="og:url"]', conteudo('https://malhaviva.pt' + endereco.pathname))
		.transform(pagina);
}

export default {
	async fetch(pedido: Request, env: { ASSETS: Fetcher }): Promise<Response> {
		if (eUmPreCarregamento(pedido)) {
			return new Response('O pré-carregamento desta página não é aceite.', {
				status: 503,
				headers: { 'Cache-Control': 'no-store', 'Content-Type': 'text/plain; charset=utf-8' },
			});
		}
		const endereco = new URL(pedido.url);
		const casa = casaDoEndereco(endereco.pathname);
		if (casa) {
			const pagina = await env.ASSETS.fetch(new Request(new URL('/navegacao', endereco), { headers: pedido.headers }));
			return pagina.ok ? paginaDaCasa(pagina, casa.numero, endereco) : pagina;
		}
		// Tudo o resto é do site: ficheiros, ou a resposta de que não existe.
		return env.ASSETS.fetch(pedido);
	},
} satisfies ExportedHandler<{ ASSETS: Fetcher }>;
