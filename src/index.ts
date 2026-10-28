/**
 * O servidor do Malha Viva.
 *
 * Tudo o que o site tem — páginas, bairro, vídeos — está na pasta `public`
 * e é servido directamente pela Cloudflare, antes de chegar aqui (ver
 * `assets` em `wrangler.jsonc`). A este código só chegam duas coisas:
 *
 *  - os pedidos das páginas pesadas do site (`run_worker_first`, em
 *    `wrangler.jsonc`), para se poder recusar o pré-carregamento (abaixo),
 *    e para pôr o nome de uma casa no bairro aberto com ela (/?casa=D31);
 *  - um endereço que não corresponda a nenhum ficheiro: o de uma casa
 *    (/casa/D31, ver `casaDoEndereco`) vai dar ao bairro com o percurso até
 *    ela; os outros têm sempre a resposta de que não existem.
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
 * levantamento tem em dois sítios, malhaviva.pt/casa/D31/2. É o endereço
 * que quem mora no bairro manda a quem o vem visitar, e o dos códigos QR
 * das casas (scripts/navegacao/ligacoes.py). Não é um ficheiro: vai dar ao
 * bairro com a casa no endereço (/?casa=D31), que abre já com o percurso
 * até ela (ver a pesquisa das casas em public/index.html).
 *
 * Porquê mandar para lá em vez de mostrar o bairro neste endereço: a
 * página do bairro vai buscar o que precisa (o motor, o bairro, as
 * miniaturas) por caminhos que contam a partir do sítio onde ela está —
 * em /casa/ não os encontrava.
 */
const CASA = /^\/casa\/([A-Za-z0-9.]{1,12})(?:\/([1-9]))?\/?$/;

/** O que pode ser o número de uma casa. */
const NUMERO = /^[A-Za-z0-9.]{1,12}$/;

/** A casa de um endereço /casa/…, ou nada. */
export function casaDoEndereco(caminho: string): { numero: string; sitio: number } | null {
	const m = CASA.exec(caminho);
	return m ? { numero: m[1].toUpperCase(), sitio: m[2] ? Number(m[2]) : 1 } : null;
}

/** A casa que o bairro tem no endereço (/?casa=D31&sitio=2), ou nada. */
export function casaNoBairro(endereco: URL): { numero: string; sitio: number } | null {
	const numero = endereco.searchParams.get('casa') ?? '';
	if (!NUMERO.test(numero)) return null;
	const sitio = Number(endereco.searchParams.get('sitio'));
	return { numero: numero.toUpperCase(), sitio: Number.isInteger(sitio) && sitio >= 1 && sitio <= 9 ? sitio : 1 };
}

/** O bairro, aberto com uma casa. */
function bairroCom(casa: { numero: string; sitio: number }, base: URL): string {
	const destino = new URL('/', base);
	destino.searchParams.set('casa', casa.numero);
	if (casa.sitio > 1) destino.searchParams.set('sitio', String(casa.sitio));
	return destino.toString();
}

/**
 * O bairro com o nome da casa no título, na descrição e na imagem do
 * endereço: é o que as aplicações de mensagens mostram na pré-visualização
 * ("Casa D31 — Bairro de Penajóia"). O número só tem letras, algarismos e
 * pontos (ver `NUMERO`): pode ir para dentro da página tal como está.
 */
function paginaDaCasa(pagina: Response, casa: { numero: string; sitio: number }): Response {
	const titulo = `Casa ${casa.numero} — Bairro de Penajóia`;
	const descricao = `Como chegar à casa ${casa.numero} no Bairro de Penajóia: o caminho no bairro, passo a passo.`;
	const endereco = `https://malhaviva.pt/casa/${casa.numero}${casa.sitio > 1 ? '/' + casa.sitio : ''}`;
	const propriedades: [string, string][] = [
		['og:type', 'website'],
		['og:site_name', 'Malha Viva'],
		['og:locale', 'pt_PT'],
		['og:title', titulo],
		['og:description', descricao],
		['og:url', endereco],
		['og:image', 'https://malhaviva.pt/navegacao/partilha.jpg'],
		['og:image:width', '1200'],
		['og:image:height', '630'],
	];
	const etiquetas = propriedades.map(([p, v]) => `<meta property="${p}" content="${v}">`).join('') +
		'<meta name="twitter:card" content="summary_large_image">';
	return new HTMLRewriter()
		.on('title', { element(e) { e.setInnerContent(titulo); } })
		.on('meta[name="description"]', { element(e) { e.setAttribute('content', descricao); } })
		.on('head', { element(e) { e.append(etiquetas, { html: true }); } })
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
		if (casa) return Response.redirect(bairroCom(casa, endereco), 302);
		// A navegação já foi uma página à parte, com o mapa visto de cima:
		// os endereços dela vão dar ao bairro (com a casa, se tinham uma).
		if (endereco.pathname === '/navegacao' || endereco.pathname === '/navegacao.html') {
			const antiga = casaNoBairro(endereco);
			return Response.redirect(antiga ? bairroCom(antiga, endereco) : new URL('/', endereco).toString(), 302);
		}
		if (endereco.pathname === '/') {
			const pedida = casaNoBairro(endereco);
			if (pedida) {
				const pagina = await env.ASSETS.fetch(pedido);
				return pagina.ok ? paginaDaCasa(pagina, pedida) : pagina;
			}
		}
		// Tudo o resto é do site: ficheiros, ou a resposta de que não existe.
		return env.ASSETS.fetch(pedido);
	},
} satisfies ExportedHandler<{ ASSETS: Fetcher }>;
