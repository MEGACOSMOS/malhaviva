/**
 * O servidor do Malha Viva.
 *
 * Tudo o que o site tem — páginas, bairro, vídeos — está na pasta `public`
 * e é servido directamente pela Cloudflare, antes de chegar aqui (ver
 * `assets` em `wrangler.jsonc`). A este código só chegam duas coisas:
 *
 *  - os pedidos das páginas pesadas do site (`run_worker_first`, em
 *    `wrangler.jsonc`), para se poder recusar o pré-carregamento (abaixo);
 *  - um endereço que não corresponda a nenhum ficheiro, e a resposta é
 *    sempre que não existe.
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

export default {
	async fetch(pedido: Request, env: { ASSETS: Fetcher }): Promise<Response> {
		if (eUmPreCarregamento(pedido)) {
			return new Response('O pré-carregamento desta página não é aceite.', {
				status: 503,
				headers: { 'Cache-Control': 'no-store', 'Content-Type': 'text/plain; charset=utf-8' },
			});
		}
		// Tudo o resto é do site: ficheiros, ou a resposta de que não existe.
		return env.ASSETS.fetch(pedido);
	},
} satisfies ExportedHandler<{ ASSETS: Fetcher }>;
