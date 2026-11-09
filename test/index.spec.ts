import { SELF } from "cloudflare:test";
import { describe, it, expect } from "vitest";

describe("servidor do Malha Viva", () => {
	it("responde que não existe a um endereço sem ficheiro", async () => {
		const response = await SELF.fetch("http://example.com/nao-existe");
		expect(response.status).toBe(404);
	});

	// O endereço de cada casa abre o bairro com o percurso até ela: ver
	// src/index.ts.
	describe("o endereço de uma casa", () => {
		it("abre o bairro no endereço curto, com o nome da casa no título e na pré-visualização", async () => {
			for (const [caminho, nome, ligacao] of [["/d31", "Casa D31", "/d31"], ["/D30-2", "Casa D30", "/d30-2"], ["/a20.1", "Casa A20.1", "/a20.1"], ["/8", "Casa 8", "/8"]]) {
				const response = await SELF.fetch("http://example.com" + caminho);
				expect(response.status, caminho).toBe(200);
				expect(response.headers.get("Cache-Control"), caminho).toBe("no-store");
				const html = await response.text();
				expect(html, caminho).toContain(`<title data-i18n-titulo="cab.bairro" data-i18n-site-primeiro>${nome} — Bairro de Penajóia</title>`);
				expect(html, caminho).toContain(`property="og:title" content="${nome} — Bairro de Penajóia"`);
				expect(html, caminho).toContain(`property="og:url" content="https://malhaviva.pt${ligacao}"`);
				expect(html, caminho).toContain("<pc-app");
			}
		});

		it("tira a barra do fim do endereço curto", async () => {
			const response = await SELF.fetch("http://example.com/d31/?idioma=en", { redirect: "manual" });
			expect(response.status).toBe(302);
			expect(response.headers.get("Location")).toBe("http://example.com/d31?idioma=en");
		});

		it("leva os endereços de antes ao endereço curto", async () => {
			for (const [caminho, destino] of [
				["/casa/D31", "/d31"],
				["/casa/a20.1", "/a20.1"],
				["/casa/D30/2/", "/d30-2"],
				["/?casa=D31", "/d31"],
				["/?casa=d30&sitio=2&idioma=en", "/d30-2?idioma=en"],
				["/navegacao", "/"],
				["/navegacao?casa=D31&sitio=2", "/d31-2"],
			]) {
				const response = await SELF.fetch("http://example.com" + caminho, { redirect: "manual" });
				expect(response.status, caminho).toBe(302);
				expect(response.headers.get("Location"), caminho).toBe("http://example.com" + destino);
			}
		});

		it("não mexe no bairro com um número que não pode ser de uma casa", async () => {
			const response = await SELF.fetch("http://example.com/?casa=" + encodeURIComponent('"><script>'));
			expect(response.status).toBe(200);
			const html = await response.text();
			expect(html).toContain('<title data-i18n-titulo="cab.bairro" data-i18n-site-primeiro>Malha Viva | Bairro de Penajóia</title>');
			expect(html).not.toContain("og:title");
		});

		it("não confunde outros endereços com o de uma casa", async () => {
			for (const caminho of ["/casa", "/casa/", "/casa/D31/0", "/casa/D31/x", "/casa/um-numero-comprido-demais", "/d31-0", "/d31/2", "/dd31", "/d", "/nao-existe"]) {
				const response = await SELF.fetch("http://example.com" + caminho);
				expect(response.status, caminho).toBe(404);
			}
		});

		it("não tira o lugar às páginas do site", async () => {
			for (const caminho of ["/creditos", "/controlos", "/timelapse"]) {
				const response = await SELF.fetch("http://example.com" + caminho);
				expect(response.status, caminho).toBe(200);
				expect(await response.text(), caminho).not.toContain("og:title");
			}
		});
	});

	// O Chrome pré-carrega em segundo plano a página que prevê que vai abrir.
	// O motor 3D, a arrancar assim, deixa o separador preso: ver src/index.ts.
	describe("pré-carregamento do Chrome (prerender)", () => {
		const pre = { "Sec-Purpose": "prefetch;prerender" };

		it("recusa o pré-carregamento do bairro", async () => {
			const response = await SELF.fetch("http://example.com/", { headers: pre });
			expect(response.status).toBe(503);
			expect(response.headers.get("Cache-Control")).toBe("no-store");
		});

		it("recusa o pré-carregamento das páginas 360º", async () => {
			for (const caminho of ["/video360", "/image360"]) {
				const response = await SELF.fetch("http://example.com" + caminho, { headers: pre });
				expect(response.status, caminho).toBe(503);
			}
		});

		it("abre o bairro normalmente quando a pessoa o abre", async () => {
			const response = await SELF.fetch("http://example.com/");
			expect(response.status).toBe(200);
			expect(await response.text()).toContain("Malha Viva");
		});

		it("deixa passar o pré-carregamento simples (só descarregar), que não corre código", async () => {
			const response = await SELF.fetch("http://example.com/", { headers: { "Sec-Purpose": "prefetch" } });
			expect(response.status).toBe(200);
		});
	});
});
