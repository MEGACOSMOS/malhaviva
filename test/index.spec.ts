import { SELF } from "cloudflare:test";
import { describe, it, expect } from "vitest";

describe("servidor do Malha Viva", () => {
	it("responde que não existe a um endereço sem ficheiro", async () => {
		const response = await SELF.fetch("http://example.com/nao-existe");
		expect(response.status).toBe(404);
	});
});
